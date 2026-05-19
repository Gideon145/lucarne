"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPublicClient, http, defineChain, parseAbiItem } from "viem";
import { SIGNAL_ATTESTOR, RPC_URL, POLYBOT_URL } from "./constants";
import { COUNTRIES } from "./countries";

// ── Chain definition ──────────────────────────────────────────────────────────

const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
  },
});

const client = createPublicClient({ chain: xlayer, transport: http(RPC_URL) });

// ── ABI ───────────────────────────────────────────────────────────────────────

const LATEST_ABI = parseAbiItem(
  "function latest(bytes3) view returns (uint8 score, uint8 regime, bytes32 signalHash, uint64 ts)"
);
const TOTAL_ABI = parseAbiItem(
  "function totalAttestations() view returns (uint256)"
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type Regime = 0 | 1 | 2 | 3; // CALM | TRENDING | VOLATILE | BREAKOUT

export interface NationData {
  iso3:        string;
  score:       number;
  regime:      Regime;
  signalHash:  string;
  ts:          number;        // unix seconds
  polybotOdds: number | null; // 0-100%
}

export interface FeedEntry {
  id:     string;
  iso3:   string;
  score:  number;
  regime: Regime;
  ts:     number;
}

export interface AttestationState {
  nations:          NationData[];
  totalAttestations: bigint;
  feed:             FeedEntry[];
  loading:          boolean;
  lastRefresh:      number | null;
  agentLive:        boolean;
  polybotLive:      boolean;
}

// ── Helper: encode iso3 as bytes3 ─────────────────────────────────────────────

function toBytes3(iso3: string): `0x${string}` {
  const hex = iso3
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as `0x${string}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAttestations(): AttestationState {
  const [nations, setNations] = useState<NationData[]>([]);
  const [totalAttestations, setTotalAttestations] = useState<bigint>(0n);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [agentLive, setAgentLive] = useState(false);
  const [polybotLive, setPolybotLive] = useState(false);

  const prevTs = useRef<Map<string, number>>(new Map());
  const polybotOdds = useRef<Map<string, number>>(new Map());

  // Fetch polybot odds (all countries in parallel, cached in ref)
  const fetchPolybot = useCallback(async () => {
    try {
      const res = await fetch(`${POLYBOT_URL}/markets/worldcup`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      setPolybotLive(true);
      // Also fetch per-country odds lazily in background
      const fetches = COUNTRIES.map(async ({ iso3 }) => {
        try {
          const r = await fetch(`${POLYBOT_URL}/odds/${iso3}`, { signal: AbortSignal.timeout(4000) });
          if (!r.ok) return;
          const data = await r.json();
          // data is an array of price points [{price, ts}] or similar
          const arr = Array.isArray(data) ? data : data?.history ?? [];
          if (arr.length > 0) {
            const last = arr[arr.length - 1];
            const price = typeof last === "number" ? last : (last?.price ?? last?.odds ?? 0);
            polybotOdds.current.set(iso3, Math.round(price * 100));
          }
        } catch { /* silent */ }
      });
      await Promise.allSettled(fetches);
    } catch {
      setPolybotLive(false);
    }
  }, []);

  // Fetch contract state
  const fetchContract = useCallback(async () => {
    try {
      // Read all 32 nations + totalAttestations in parallel
      const [totalResult, ...latestResults] = await Promise.allSettled([
        client.readContract({ address: SIGNAL_ATTESTOR, abi: [TOTAL_ABI], functionName: "totalAttestations" }),
        ...COUNTRIES.map(({ iso3 }) =>
          client.readContract({
            address: SIGNAL_ATTESTOR,
            abi: [LATEST_ABI],
            functionName: "latest",
            args: [toBytes3(iso3)],
          })
        ),
      ]);

      if (totalResult.status === "fulfilled") {
        const total = totalResult.value as bigint;
        setTotalAttestations(total);
        // If we got a non-zero total, agent is live
        setAgentLive(total > 0n);
      }

      const newNations: NationData[] = [];
      const newFeedEntries: FeedEntry[] = [];

      latestResults.forEach((result, idx) => {
        const { iso3 } = COUNTRIES[idx];
        if (result.status !== "fulfilled") {
          newNations.push({
            iso3, score: 0, regime: 0, signalHash: "0x", ts: 0,
            polybotOdds: polybotOdds.current.get(iso3) ?? null,
          });
          return;
        }

        const raw = result.value as readonly [number, number, `0x${string}`, bigint];
        const score  = Number(raw[0]);
        const regime = Number(raw[1]) as Regime;
        const ts     = Number(raw[3]);

        newNations.push({
          iso3, score, regime,
          signalHash: raw[2],
          ts,
          polybotOdds: polybotOdds.current.get(iso3) ?? null,
        });

        // Detect new attestation (ts changed) → add to live feed
        const prev = prevTs.current.get(iso3) ?? 0;
        if (ts > 0 && ts !== prev) {
          newFeedEntries.push({ id: `${iso3}-${ts}`, iso3, score, regime, ts });
          prevTs.current.set(iso3, ts);
        }
      });

      setNations(newNations);

      if (newFeedEntries.length > 0) {
        setFeed((prev) => {
          const merged = [...newFeedEntries, ...prev].slice(0, 40);
          // Deduplicate by id
          const seen = new Set<string>();
          return merged.filter((e) => seen.has(e.id) ? false : (seen.add(e.id), true));
        });
      }

      setLastRefresh(Date.now());
      setLoading(false);
    } catch (err) {
      console.error("Contract read error:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolybot();
    fetchContract();

    const contractTimer = setInterval(fetchContract, 15_000);
    const polybotTimer  = setInterval(fetchPolybot, 60_000);

    return () => {
      clearInterval(contractTimer);
      clearInterval(polybotTimer);
    };
  }, [fetchContract, fetchPolybot]);

  return { nations, totalAttestations, feed, loading, lastRefresh, agentLive, polybotLive };
}
