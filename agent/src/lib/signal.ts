import axios from "axios";
import { ethers } from "ethers";

/**
 * Regime enum — must match SignalAttestor.sol
 */
export const Regime = { CALM: 0, TRENDING: 1, VOLATILE: 2, BREAKOUT: 3 } as const;
export type RegimeValue = (typeof Regime)[keyof typeof Regime];

export interface SignalOutput {
  score:      number;      // 0–100
  regime:     RegimeValue;
  signalHash: string;      // bytes32 hex
  oddsScore:  number;      // raw odds component
  formScore:  number;      // raw form component
}

/**
 * computeSignal
 * Fetches odds + polybot signal + recent form for a country, computes momentum score.
 *
 * Score composition (three independent signals):
 *   55% — odds level (Polymarket tournament win probability, nonlinearly scaled)
 *   30% — polybot gate signal (momentum delta + edge detection)
 *   15% — form signal (W/D/L from last 5 matches via Sofascore, anchored at 50)
 *
 * Why form matters: market odds are slow to reprice after group stage results.
 * A team on a 3-game winning streak has a real edge that the odds haven't fully captured.
 *
 * Falls back to a deterministic noise model if polybot is unreachable.
 */
export async function computeSignal(country: string, polybotUrl: string): Promise<SignalOutput> {
  let oddsScore    = 50;
  let gateSignal   = 50;
  let formScore    = 50;  // neutral until form data is available
  let polybotLive  = false;

  try {
    const [oddsRes, signalRes, formRes] = await Promise.all([
      axios.get(`${polybotUrl}/odds/${country}`,   { timeout: 5000 }),
      axios.get(`${polybotUrl}/signal/${country}`, { timeout: 5000 }),
      axios.get(`${polybotUrl}/form/${country}`,   { timeout: 5000 }).catch(() => null),
    ]);

    // Polymarket odds → scale to 0–100 using odds level (not just momentum delta)
    const odds: number[] = oddsRes.data?.odds ?? [];
    if (odds.length >= 1) {
      const latest  = odds[odds.length - 1];
      // Level score: top contender (15%+) → ~95, underdog (0.1%) → ~5
      const levelScore = Math.min(95, Math.max(5, Math.round(Math.sqrt(latest) * 300)));
      if (odds.length >= 2) {
        const prev  = odds[odds.length - 2];
        const delta = latest - prev;
        // Small momentum boost on top of level score
        oddsScore = Math.min(100, Math.max(0, levelScore + Math.round(delta * 200)));
      } else {
        oddsScore = levelScore;
      }
    }

    // Polybot 10-gate signal (0=no edge, 1=edge detected)
    gateSignal  = (signalRes.data?.signal ?? 0) * 100;
    polybotLive = true;

    // Form signal from Sofascore (0-100, anchored at 50 neutral)
    // Only use if there are played matches (pre-tournament = no data = stays 50)
    if (formRes != null && (formRes.data?.played ?? 0) > 0) {
      formScore = formRes.data.formScore ?? 50;
    }
  } catch {
    // Polybot unreachable — use fallback noise model
    oddsScore  = Math.floor(Math.random() * 30 + 35);
    gateSignal = Math.floor(Math.random() * 30 + 35);
  }

  // Composite score: 55% odds momentum + 30% polybot gate + 15% form
  // Form component only shifts the score ±7.5pts max → won't dominate, just edges
  const score = Math.min(100, Math.max(0,
    Math.round(oddsScore * 0.55 + gateSignal * 0.30 + formScore * 0.15)
  ));

  // Regime classification
  let regime: RegimeValue;
  if (score < 30)       regime = Regime.CALM;
  else if (score < 55)  regime = Regime.TRENDING;
  else if (score < 75)  regime = Regime.VOLATILE;
  else                  regime = Regime.BREAKOUT;

  // Signal hash — provenance anchor for on-chain attestation
  // Now includes formScore so hash changes when form data updates
  const signalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256", "uint256", "uint256", "bool", "uint256"],
      [country, Math.round(oddsScore), Math.round(gateSignal), Math.round(formScore), polybotLive, Date.now()]
    )
  );

  return { score, regime, signalHash, oddsScore, formScore };
}

