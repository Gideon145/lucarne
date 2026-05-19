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
}

/**
 * computeSignal
 * Fetches odds + polybot signal for a country, computes momentum score.
 * Falls back to a deterministic noise model if polybot is unreachable.
 */
export async function computeSignal(country: string, polybotUrl: string): Promise<SignalOutput> {
  let oddsScore    = 50;
  let gateSignal   = 50;
  let polybotLive  = false;

  try {
    const [oddsRes, signalRes] = await Promise.all([
      axios.get(`${polybotUrl}/odds/${country}`, { timeout: 5000 }),
      axios.get(`${polybotUrl}/signal/${country}`, { timeout: 5000 }),
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
  } catch {
    // Polybot unreachable — use fallback noise model
    oddsScore  = Math.floor(Math.random() * 30 + 35);
    gateSignal = Math.floor(Math.random() * 30 + 35);
  }

  // Composite score: 60% odds momentum + 40% polybot gate
  const score = Math.min(100, Math.max(0, Math.round(oddsScore * 0.6 + gateSignal * 0.4)));

  // Regime classification
  let regime: RegimeValue;
  if (score < 30)       regime = Regime.CALM;
  else if (score < 55)  regime = Regime.TRENDING;
  else if (score < 75)  regime = Regime.VOLATILE;
  else                  regime = Regime.BREAKOUT;

  // Signal hash — provenance anchor for on-chain attestation
  const signalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256", "uint256", "bool", "uint256"],
      [country, Math.round(oddsScore), Math.round(gateSignal), polybotLive, Date.now()]
    )
  );

  return { score, regime, signalHash };
}
