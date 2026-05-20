import "dotenv/config";
import { ethers } from "ethers";
import { computeSignal } from "./lib/signal";
import { checkAndRecordOutcomes } from "./lib/outcome";
import { logger } from "./lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  rpcUrl:          process.env.RPC_URL          || "https://rpc.xlayer.tech",
  chainId:         parseInt(process.env.CHAIN_ID || "196"),
  // Normalize: ethers v6 requires 0x-prefixed private key
  privateKey:      (() => { const k = process.env.PRIVATE_KEY || ""; return k.startsWith("0x") ? k : `0x${k}`; })(),
  contractAddress: process.env.SIGNAL_ATTESTOR   || "",
  outcomeAddress:  process.env.OUTCOME_ATTESTOR  || "",  // OutcomeAttestor — optional until deployed

  // Signal-driven write gate thresholds (Provus-pattern)
  minScoreDelta:   parseInt(process.env.MIN_SCORE_DELTA   || "3"),   // |Δscore| must exceed this to write
  heartbeatSecs:   parseInt(process.env.HEARTBEAT_SECS    || "14400"), // 4h forced write regardless
  maxTxPerDay:     parseInt(process.env.MAX_TX_PER_DAY    || "6000"),  // hard daily TX cap
  loopIntervalMs:  parseInt(process.env.LOOP_INTERVAL_MS  || "60000"), // 60s compute cycle

  // Polybot sidecar URL (FastAPI)
  polybotUrl:      process.env.POLYBOT_URL || "http://localhost:8001",
};

// ─────────────────────────────────────────────────────────────────────────────
// 32 World Cup 2026 nations (ISO 3166-1 alpha-3)
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRIES: string[] = [
  // CONMEBOL (6)
  "ARG", "BRA", "URU", "COL", "ECU", "PAR",
  // UEFA (16)
  "FRA", "ENG", "ESP", "GER", "POR", "NED", "BEL", "CRO",
  "CHE", "NOR", "AUT", "SWE", "SCO", "CZE", "BIH", "TUR",
  // CONCACAF (6)
  "USA", "MEX", "CAN", "PAN", "HAI", "CUW",
  // CAF (10)
  "MAR", "SEN", "GHA", "TUN", "EGY", "CIV", "ALG", "CPV", "RSA", "COD",
  // AFC (9)
  "JPN", "KOR", "AUS", "IRN", "KSA", "QAT", "IRQ", "JOR", "UZB",
  // OFC (1)
  "NZL",
];

// ─────────────────────────────────────────────────────────────────────────────
// SignalAttestor ABI (minimal — only what the agent calls)
// ─────────────────────────────────────────────────────────────────────────────

const ATTESTOR_ABI = [
  "function attest(bytes3 country, uint8 score, uint8 regime, bytes32 signalHash) external",
  "function totalAttestations() external view returns (uint256)",
];

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface CountryState {
  lastScore:      number;
  lastRegime:     number;
  lastWrittenAt:  number; // unix seconds
}

const countryState: Map<string, CountryState> = new Map(
  COUNTRIES.map((c) => [c, { lastScore: -1, lastRegime: -1, lastWrittenAt: 0 }])
);

let txToday      = 0;
let dayStartMs   = Date.now();
let totalTxCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resetDailyCounterIfNeeded(): void {
  const msSinceDayStart = Date.now() - dayStartMs;
  if (msSinceDayStart >= 86_400_000) {
    txToday    = 0;
    dayStartMs = Date.now();
    logger.info("Daily TX counter reset");
  }
}

function shouldWrite(country: string, score: number, regime: number): boolean {
  const s = countryState.get(country)!;
  const nowSecs = Math.floor(Date.now() / 1000);

  const scoreDelta    = Math.abs(score - s.lastScore);
  const regimeChanged = regime !== s.lastRegime && s.lastRegime !== -1;
  const heartbeat     = (nowSecs - s.lastWrittenAt) >= CONFIG.heartbeatSecs;
  const firstWrite    = s.lastScore === -1;

  return firstWrite || scoreDelta > CONFIG.minScoreDelta || regimeChanged || heartbeat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  logger.info("LUCARNE Signal Engine starting");
  logger.info(`Network  : X Layer Mainnet (chainId ${CONFIG.chainId})`);
  logger.info(`RPC      : ${CONFIG.rpcUrl}`);
  logger.info(`Contract : ${CONFIG.contractAddress || "NOT SET — deploy first"}`);
  logger.info(`Loop     : ${CONFIG.loopIntervalMs / 1000}s · Gate: Δ>${CONFIG.minScoreDelta} | regime change | ${CONFIG.heartbeatSecs / 3600}h heartbeat`);
  logger.info(`Daily cap: ${CONFIG.maxTxPerDay} TXs\n`);

  if (!CONFIG.privateKey) {
    logger.error("PRIVATE_KEY not set. Set it in .env and restart.");
    process.exit(1);
  }
  if (!CONFIG.contractAddress) {
    logger.error("SIGNAL_ATTESTOR address not set. Deploy contracts first.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId);
  const wallet   = new ethers.Wallet(CONFIG.privateKey, provider);
  const attestor = new ethers.Contract(CONFIG.contractAddress, ATTESTOR_ABI, wallet);

  logger.info(`Agent wallet : ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  logger.info(`OKB balance  : ${ethers.formatEther(balance)} OKB`);

  // Balance guard — pause if < 3 days estimated runway
  const estDailyBurnOKB = 0.05; // ~$0.05/day conservative
  const minSafeBalance  = ethers.parseEther(String(estDailyBurnOKB * 3));
  if (balance < minSafeBalance) {
    logger.warn(`⚠  Low OKB balance. Top up wallet ${wallet.address} to continue.`);
  }

  while (true) {
    resetDailyCounterIfNeeded();
    const cycleStart = Date.now();

    if (txToday >= CONFIG.maxTxPerDay) {
      logger.warn(`Daily TX cap (${CONFIG.maxTxPerDay}) reached. Skipping writes until reset.`);
      await sleep(CONFIG.loopIntervalMs);
      continue;
    }

    // Process all 48 WC 2026 countries in this cycle
    for (const country of COUNTRIES) {
      try {
        // Compute signal (calls polybot sidecar + local processors)
        const { score, regime, signalHash } = await computeSignal(country, CONFIG.polybotUrl);

        if (!shouldWrite(country, score, regime)) {
          logger.debug(`${country} | score=${score} regime=${regime} | gate suppressed`);
          continue;
        }

        if (txToday >= CONFIG.maxTxPerDay) break;

        // Write on-chain
        const tx = await attestor.attest(
          ethers.encodeBytes32String(country).slice(0, 8), // bytes3
          score,
          regime,
          signalHash
        );
        await tx.wait(1);

        txToday++;
        totalTxCount++;
        countryState.set(country, {
          lastScore:     score,
          lastRegime:    regime,
          lastWrittenAt: Math.floor(Date.now() / 1000),
        });

        logger.info(`✅ ${country} | score=${score} regime=${regime} | tx=${tx.hash} | total=${totalTxCount} | today=${txToday}`);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`${country} | error: ${msg}`);
      }
    }

    // Log cycle summary
    const cycleDuration = ((Date.now() - cycleStart) / 1000).toFixed(1);
    logger.info(`── cycle done in ${cycleDuration}s | txToday=${txToday}/${CONFIG.maxTxPerDay} | total=${totalTxCount}`);

    // ── Outcome writer: check for completed WC matches and record on-chain ──
    // Runs after every signal cycle. Deduplication prevents double-writes.
    // No-op until OutcomeAttestor is deployed (OUTCOME_ATTESTOR env var).
    try {
      await checkAndRecordOutcomes({
        outcomeAttestorAddress: CONFIG.outcomeAddress,
        signalAttestorAddress:  CONFIG.contractAddress,
        wallet,
        polybotUrl:             CONFIG.polybotUrl,
      });
    } catch (err) {
      logger.error(`Outcome writer error: ${String(err).slice(0, 80)}`);
    }

    await sleep(CONFIG.loopIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
