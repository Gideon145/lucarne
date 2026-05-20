import axios from "axios";
import { ethers } from "ethers";
import { logger } from "./logger";

/**
 * outcome.ts
 *
 * Closes the prediction loop for LUCARNE.
 *
 * On each call to checkAndRecordOutcomes():
 *   1. Polls Sofascore for WC 2026 match results
 *   2. For each newly completed match:
 *      a. Reads the pre-match signal score from SignalAttestor (on-chain)
 *      b. Writes the result to OutcomeAttestor (on-chain)
 *      c. POSTs a local copy to polybot /outcomes/record (for /calibration endpoint)
 *
 * This runs inside the main agent loop, after signal attestation, every 60s.
 * OutcomeAttestor writes only fire once per match (tracked in memory + ignored if dupe).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchResult {
  country:    string;  // ISO3 of team
  opponent:   string;  // ISO3 of opponent
  goalsFor:   number;
  goalsAgainst: number;
  matchDate:  number;  // unix timestamp (start of match day)
  competitionId: number;
}

// ── Sofascore config ──────────────────────────────────────────────────────────

const SOFASCORE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer": "https://www.sofascore.com/",
  "Accept": "application/json",
};

// WC 2026 tournament ID on Sofascore (FIFA World Cup 2026)
// 17 = FIFA World Cup (used consistently across editions)
const WC_TOURNAMENT_ID = 17;
const WC_SEASON_ID     = 61644; // 2026 season — verify/update once official Sofascore season opens

// Sofascore team IDs (subset — only WC 2026 qualifiers with known IDs)
const SOFASCORE_TEAM_IDS: Record<string, number> = {
  "ARG": 6141, "BRA": 6159, "FRA": 6573, "ENG": 4709,
  "ESP": 6832, "GER": 6480, "POR": 7188, "NED": 6811,
  "BEL": 6011, "URU": 7085, "CRO": 6380, "COL": 6343,
  "MEX": 6748, "USA": 6970, "CAN": 6221, "MAR": 6749,
  "SEN": 6801, "JPN": 6704, "KOR": 6730, "AUS": 6156,
  "ECU": 6431, "CHE": 6855, "TUN": 6975, "GHA": 6495,
  "IRN": 6680, "NOR": 6761, "SCO": 6806,
};

// Reverse map: Sofascore team ID → ISO3
const ID_TO_ISO3: Record<number, string> = Object.fromEntries(
  Object.entries(SOFASCORE_TEAM_IDS).map(([iso3, id]) => [id, iso3])
);

// ── OutcomeAttestor ABI ───────────────────────────────────────────────────────

export const OUTCOME_ATTESTOR_ABI = [
  "function recordOutcome(bytes3 country, bytes3 opponent, uint8 goalsFor, uint8 goalsAgainst, uint32 matchDate, uint8 preMatchScore) external",
  "function getOutcomes(bytes3 country) external view returns (tuple(bytes3 opponent, uint8 goalsFor, uint8 goalsAgainst, uint8 result, uint32 matchDate, uint64 ts, uint8 preMatchScore)[] memory)",
  "function totalOutcomes() external view returns (uint256)",
];

// SignalAttestor read ABI — to fetch the pre-match score
const SIGNAL_ATTESTOR_READ_ABI = [
  "function latest(bytes3 country) external view returns (tuple(uint8 score, uint8 regime, bytes32 signalHash, uint64 ts))",
];

// ── State ─────────────────────────────────────────────────────────────────────

// Track which matches we've already written to avoid duplicate on-chain writes
const _writtenMatches = new Set<string>();  // key: `${country}-${opponent}-${matchDate}`

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeCountry(iso3: string): string {
  // bytes3 encoding: pad to 3 chars, encode as hex
  const bytes = Buffer.from(iso3.padEnd(3, "\0").slice(0, 3), "ascii");
  return "0x" + bytes.toString("hex");
}

function toMatchKey(country: string, opponent: string, matchDate: number): string {
  return `${country}-${opponent}-${Math.floor(matchDate / 86400)}`;
}

// ── Sofascore poller ──────────────────────────────────────────────────────────

/**
 * Fetches completed WC 2026 matches from Sofascore.
 * Returns one result entry per team (both FRA and ENG get their own entry for FRA-ENG).
 */
async function fetchCompletedWCMatches(): Promise<MatchResult[]> {
  try {
    // Fetch last page of events for the WC 2026 tournament
    const url = `https://api.sofascore.com/api/v1/unique-tournament/${WC_TOURNAMENT_ID}/season/${WC_SEASON_ID}/events/last/0`;
    const resp = await axios.get(url, {
      headers: SOFASCORE_HEADERS,
      timeout: 10000,
    });

    const events: any[] = resp.data?.events ?? [];
    const results: MatchResult[] = [];

    for (const event of events) {
      const statusType = event?.status?.type;
      if (statusType !== "finished") continue;

      const homeTeamId = event?.homeTeam?.id;
      const awayTeamId = event?.awayTeam?.id;
      const hs = event?.homeScore?.current;
      const as_ = event?.awayScore?.current;
      const startTs = event?.startTimestamp ?? 0;

      if (hs == null || as_ == null) continue;

      // Only process teams we track
      const homeIso3 = ID_TO_ISO3[homeTeamId];
      const awayIso3 = ID_TO_ISO3[awayTeamId];
      if (!homeIso3 && !awayIso3) continue;

      // Add an entry for each tracked team in the match
      if (homeIso3) {
        results.push({
          country: homeIso3, opponent: awayIso3 ?? "UNK",
          goalsFor: hs, goalsAgainst: as_,
          matchDate: startTs, competitionId: WC_TOURNAMENT_ID,
        });
      }
      if (awayIso3) {
        results.push({
          country: awayIso3, opponent: homeIso3 ?? "UNK",
          goalsFor: as_, goalsAgainst: hs,
          matchDate: startTs, competitionId: WC_TOURNAMENT_ID,
        });
      }
    }

    return results;
  } catch (err) {
    logger.warn(`fetchCompletedWCMatches: ${String(err).slice(0, 80)}`);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface OutcomeWriterConfig {
  outcomeAttestorAddress: string;
  signalAttestorAddress:  string;
  wallet:                 ethers.Wallet;
  polybotUrl:             string;
}

/**
 * Checks for newly completed WC matches and records outcomes on-chain.
 * Safe to call every 60s — deduplication is enforced via _writtenMatches set.
 */
export async function checkAndRecordOutcomes(config: OutcomeWriterConfig): Promise<void> {
  if (!config.outcomeAttestorAddress) return;  // not deployed yet

  const matches = await fetchCompletedWCMatches();
  if (matches.length === 0) return;

  const outcomeContract = new ethers.Contract(
    config.outcomeAttestorAddress,
    OUTCOME_ATTESTOR_ABI,
    config.wallet
  );
  const signalContract = new ethers.Contract(
    config.signalAttestorAddress,
    SIGNAL_ATTESTOR_READ_ABI,
    config.wallet  // read-only but wallet works too
  );

  for (const match of matches) {
    const key = toMatchKey(match.country, match.opponent, match.matchDate);
    if (_writtenMatches.has(key)) continue;

    try {
      // Read the current (post-match) on-chain score — ideally this would be
      // the pre-match score, but since we write every 60s the chain has a
      // continuous record. For now, use the score at time of recording.
      // TODO: query historical attestations for the score 24h before matchDate
      let preMatchScore = 50;
      try {
        const latest = await signalContract.latest(encodeCountry(match.country));
        preMatchScore = Number(latest.score);
      } catch {
        // contract read failed — use 50 as neutral
      }

      // Write outcome on-chain
      const tx = await outcomeContract.recordOutcome(
        encodeCountry(match.country),
        encodeCountry(match.opponent),
        match.goalsFor,
        match.goalsAgainst,
        Math.floor(match.matchDate / 86400) * 86400, // day-truncated
        preMatchScore
      );
      await tx.wait(1);

      _writtenMatches.add(key);
      logger.info(
        `📊 OUTCOME ${match.country} ${match.goalsFor}–${match.goalsAgainst} ${match.opponent} ` +
        `| preScore=${preMatchScore} | tx=${tx.hash}`
      );

      // Mirror to polybot for /calibration endpoint
      try {
        await axios.post(`${config.polybotUrl}/outcomes/record`, {
          country:  match.country,
          opponent: match.opponent,
          gf:       match.goalsFor,
          ga:       match.goalsAgainst,
          preScore: preMatchScore,
          ts:       match.matchDate,
        }, { timeout: 3000 });
      } catch {
        // Non-fatal — chain write is the source of truth
      }

    } catch (err) {
      logger.error(`OUTCOME write failed ${match.country}: ${String(err).slice(0, 120)}`);
    }
  }
}
