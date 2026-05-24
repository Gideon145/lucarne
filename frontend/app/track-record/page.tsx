"use client";

/**
 * /track-record — Public on-chain ledger of LUCARNE's agent signal performance.
 *
 * Reads MatchResultAttestor (totalCorrect / totalResolved) for the headline
 * hit-rate, then pulls every MatchResolved event log to render a per-game
 * pick-vs-actual list. Read-only, no wallet, no backend — pure RPC.
 *
 * Also reads LucarnePredictions.totalPredictions() so judges can compare the
 * agent's signal track-record against community throughput.
 */

import { useEffect, useState } from "react";
import {
  MATCH_RESULT_ATTESTOR,
  MATCH_SIGNAL_ATTESTOR,
  PREDICTIONS_CONTRACT,
  RPC_URL,
  OKLINK_BASE,
} from "@/lib/constants";

// ── On-chain primitives ───────────────────────────────────────────────────────

// keccak256("MatchResolved(bytes32,uint8,uint8,bool,uint40)")
const TOPIC_MATCH_RESOLVED =
  "0x58a0f9722c400f56751fe49edfa63d2de8c1a4497abd325838e61eda7d4dd4d6";

// Function selectors (first 4 bytes of keccak256 of signature)
const SEL_TOTAL_RESOLVED = "0xf5e8e75f"; // totalResolved()
const SEL_TOTAL_CORRECT  = "0x5dec1d7c"; // totalCorrect()
const SEL_TOTAL_PREDS    = "0x779bd562"; // totalPredictions()

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "RPC error");
  return data.result as T;
}

async function callUint(to: string, selector: string): Promise<bigint> {
  const result = await rpc<string>("eth_call", [{ to, data: selector }, "latest"]);
  if (!result || result === "0x") return 0n;
  return BigInt(result);
}

// Decode a MatchResolved log:
//   topics[0] = signature
//   topics[1] = gameId (indexed bytes32)
//   data      = abi-encoded (uint8 actualOutcome, uint8 signalCall, bool signalCorrect, uint40 resolvedAt)
type Resolved = {
  gameId: string;
  actualOutcome: number;
  signalCall: number;
  signalCorrect: boolean;
  resolvedAt: number;
  txHash: string;
  blockNumber: number;
};

function decodeResolved(log: {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
}): Resolved {
  const gameId = log.topics[1];
  // data is 0x + 4 * 32-byte words
  const d = log.data.slice(2);
  const w = (i: number) => d.slice(i * 64, (i + 1) * 64);
  const actualOutcome = parseInt(w(0).slice(-2), 16);
  const signalCall    = parseInt(w(1).slice(-2), 16);
  const signalCorrect = parseInt(w(2), 16) === 1;
  const resolvedAt    = parseInt(w(3), 16);
  return {
    gameId,
    actualOutcome,
    signalCall,
    signalCorrect,
    resolvedAt,
    txHash: log.transactionHash,
    blockNumber: parseInt(log.blockNumber, 16),
  };
}

const OUTCOME = ["HOME", "DRAW", "AWAY"] as const;

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Stats = {
  totalCorrect: bigint;
  totalResolved: bigint;
  totalPredictions: bigint;
  resolved: Resolved[];
};

// The public X Layer RPC caps eth_getLogs at a 100-block window, so we fan
// out parallel range scans over the recent chain history.
const SCAN_WINDOW    = 100;     // blocks per request (RPC cap)
const SCAN_BACK      = 200_000; // ~5 days of X Layer time
const SCAN_BATCH     = 25;      // concurrent requests per round

type RawLog = { topics: string[]; data: string; transactionHash: string; blockNumber: string };

async function fetchHeadline(): Promise<Pick<Stats, "totalCorrect" | "totalResolved" | "totalPredictions">> {
  const [totalCorrect, totalResolved, totalPredictions] = await Promise.all([
    callUint(MATCH_RESULT_ATTESTOR, SEL_TOTAL_CORRECT),
    callUint(MATCH_RESULT_ATTESTOR, SEL_TOTAL_RESOLVED),
    callUint(PREDICTIONS_CONTRACT, SEL_TOTAL_PREDS),
  ]);
  return { totalCorrect, totalResolved, totalPredictions };
}

async function fetchResolvedLogs(onProgress?: (pct: number) => void): Promise<Resolved[]> {
  const latestHex = await rpc<string>("eth_blockNumber", []);
  const latest    = parseInt(latestHex, 16);
  const from      = Math.max(0, latest - SCAN_BACK);

  const ranges: Array<[number, number]> = [];
  for (let hi = latest; hi > from; hi -= SCAN_WINDOW) {
    const lo = Math.max(from, hi - SCAN_WINDOW + 1);
    ranges.push([lo, hi]);
  }

  const collected: RawLog[] = [];
  for (let i = 0; i < ranges.length; i += SCAN_BATCH) {
    const batch = ranges.slice(i, i + SCAN_BATCH);
    const results = await Promise.all(
      batch.map(([lo, hi]) =>
        rpc<RawLog[]>("eth_getLogs", [
          {
            address: MATCH_RESULT_ATTESTOR,
            topics:  [TOPIC_MATCH_RESOLVED],
            fromBlock: "0x" + lo.toString(16),
            toBlock:   "0x" + hi.toString(16),
          },
        ]).catch(() => [] as RawLog[]),
      ),
    );
    for (const r of results) collected.push(...r);
    if (onProgress) onProgress(Math.min(100, Math.round(((i + batch.length) / ranges.length) * 100)));
  }

  return collected.map(decodeResolved).sort((a, b) => b.blockNumber - a.blockNumber);
}

export default function TrackRecord() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scanPct, setScanPct] = useState<number>(0);
  const [scanning, setScanning] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headline = await fetchHeadline();
        if (!alive) return;
        setStats({ ...headline, resolved: [] });

        const resolved = await fetchResolvedLogs((pct) => {
          if (alive) setScanPct(pct);
        });
        if (!alive) return;
        setStats({ ...headline, resolved });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (alive) setScanning(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const hitRatePct =
    stats && stats.totalResolved > 0n
      ? Number((stats.totalCorrect * 10000n) / stats.totalResolved) / 100
      : null;

  return (
    <main className="hud-grid" style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header
          style={{
            marginBottom: "2rem",
            borderBottom: "1px solid var(--border-glow)",
            paddingBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--gold)",
                letterSpacing: "0.2em",
                marginBottom: "0.25rem",
              }}
            >
              ⬢ AGENT TRACK RECORD
            </div>
            <h1
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontSize: "clamp(1.5rem, 6vw, 2.4rem)",
                margin: 0,
                color: "var(--text-primary)",
              }}
            >
              SIGNAL VS REALITY — ON-CHAIN
            </h1>
            <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginTop: "0.4rem" }}>
              Every pre-kickoff signal the LUCARNE agent writes is anchored on X Layer.
              Every settled result is closed against it. This page reads both —
              no analytics layer, no spreadsheet, no trust required.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <a href="/" style={btn}>← Live Dashboard</a>
            <a href="/judge" style={btn}>JUDGE MODE ↗</a>
            <a href="/leaderboard" style={btn}>USER LEADERBOARD ↗</a>
          </div>
        </header>

        {err && (
          <section style={{ ...card, color: "var(--red)", fontSize: "0.9rem" }}>
            RPC error: {err}
          </section>
        )}

        {/* ── Headline tiles ─────────────────────────────────────────────── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <Tile
            label="AGENT HIT RATE"
            value={
              hitRatePct === null
                ? stats
                  ? "—"
                  : "…"
                : `${hitRatePct.toFixed(1)}%`
            }
            sub={
              stats
                ? `${stats.totalCorrect.toString()} / ${stats.totalResolved.toString()} signals correct`
                : "loading…"
            }
            big
          />
          <Tile
            label="MATCHES RESOLVED"
            value={stats ? stats.totalResolved.toString() : "…"}
            sub="closed signal loops"
          />
          <Tile
            label="COMMUNITY PREDICTIONS"
            value={stats ? stats.totalPredictions.toString() : "…"}
            sub="wallet attestations across all games"
          />
        </section>

        {/* ── Per-match ledger ───────────────────────────────────────────── */}
        <section style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                color: "var(--gold)",
                fontSize: "0.8rem",
                letterSpacing: "0.18em",
              }}
            >
              ⬢ RESOLVED MATCHES — NEWEST FIRST
            </div>
            <a
              href={`${OKLINK_BASE}/address/${MATCH_RESULT_ATTESTOR}`}
              target="_blank"
              rel="noreferrer"
              style={inlineLink}
            >
              contract ↗
            </a>
          </div>

          {!stats && !err && (
            <div style={{ color: "var(--text-dim)" }}>Reading on-chain state…</div>
          )}
          {stats && scanning && stats.resolved.length === 0 && (
            <div style={{ color: "var(--text-dim)" }}>
              Scanning recent X Layer blocks for resolved matches… {scanPct}%
            </div>
          )}
          {stats && !scanning && stats.resolved.length === 0 && (
            <div style={{ color: "var(--text-dim)" }}>
              No <code>MatchResolved</code> events in the last ~5 days of chain
              history. The headline counter above is read directly from{" "}
              <code>accuracy()</code> — older resolutions remain visible on{" "}
              <a
                href={`${OKLINK_BASE}/address/${MATCH_RESULT_ATTESTOR}`}
                target="_blank"
                rel="noreferrer"
                style={inlineLink}
              >
                OKLink ↗
              </a>
              .
            </div>
          )}

          {stats && stats.resolved.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                <thead>
                  <tr
                    style={{
                      color: "var(--text-dim)",
                      textAlign: "left",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th style={th}>Date</th>
                    <th style={th}>Game ID</th>
                    <th style={th}>Agent Pick</th>
                    <th style={th}>Actual</th>
                    <th style={th}>Outcome</th>
                    <th style={th}>TX</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.resolved.map((r) => (
                    <tr key={r.txHash} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={td}>{fmtDate(r.resolvedAt)}</td>
                      <td
                        style={{
                          ...td,
                          fontFamily: "var(--font-mono), monospace",
                          color: "var(--text-primary)",
                        }}
                      >
                        {shortHash(r.gameId)}
                      </td>
                      <td
                        style={{
                          ...td,
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-orbitron), sans-serif",
                        }}
                      >
                        {OUTCOME[r.signalCall] ?? "?"}
                      </td>
                      <td
                        style={{
                          ...td,
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-orbitron), sans-serif",
                        }}
                      >
                        {OUTCOME[r.actualOutcome] ?? "?"}
                      </td>
                      <td
                        style={{
                          ...td,
                          color: r.signalCorrect ? "var(--green)" : "var(--red)",
                          fontFamily: "var(--font-orbitron), sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        {r.signalCorrect ? "✓ HIT" : "✗ MISS"}
                      </td>
                      <td style={td}>
                        <a
                          href={`${OKLINK_BASE}/tx/${r.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={inlineLink}
                        >
                          view ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── How it works ───────────────────────────────────────────────── */}
        <section style={{ ...card, color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <div style={{ marginBottom: "0.5rem", color: "var(--text-primary)" }}>
            How the loop closes
          </div>
          Before kickoff, the LUCARNE agent writes a signal to{" "}
          <a
            href={`${OKLINK_BASE}/address/${MATCH_SIGNAL_ATTESTOR}`}
            target="_blank"
            rel="noreferrer"
            style={inlineLink}
          >
            MatchSignalAttestor
          </a>{" "}
          (probabilities + favoured outcome + a hash of all raw inputs). After the
          final whistle, the resolver posts the real result to{" "}
          <a
            href={`${OKLINK_BASE}/address/${MATCH_RESULT_ATTESTOR}`}
            target="_blank"
            rel="noreferrer"
            style={inlineLink}
          >
            MatchResultAttestor
          </a>
          , which reads the pre-match signal and computes <code>signalCorrect</code>{" "}
          on-chain. Global counters <code>totalCorrect</code> and{" "}
          <code>totalResolved</code> update atomically. This page renders both —
          no off-chain bookkeeping in the path.
        </section>

        <footer
          style={{
            textAlign: "center",
            color: "var(--text-faint)",
            fontSize: "0.8rem",
            padding: "1rem 0",
            lineHeight: 1.7,
          }}
        >
          NOT FINANCIAL ADVICE · 18+ · SELF-CUSTODIAL · AI OUTPUTS MAY BE INACCURATE · DIGITAL ASSETS ARE VOLATILE
        </footer>
      </div>
    </main>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  big = false,
}: {
  label: string;
  value: string;
  sub: string;
  big?: boolean;
}) {
  return (
    <div style={card}>
      <div
        style={{
          color: "var(--gold)",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          color: "var(--text-primary)",
          fontSize: big ? "clamp(2rem, 7vw, 3rem)" : "clamp(1.4rem, 4vw, 1.8rem)",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
        {sub}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  padding: "1.25rem",
  marginBottom: "1rem",
  background: "var(--card)",
  border: "1px solid var(--border-glow)",
  borderRadius: 8,
};

const th: React.CSSProperties = {
  padding: "0.5rem",
  fontSize: "0.8rem",
  letterSpacing: "0.12em",
  fontWeight: 500,
  textTransform: "uppercase",
};

const td: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  verticalAlign: "top",
  color: "var(--text-dim)",
};

const btn: React.CSSProperties = {
  color: "var(--green)",
  textDecoration: "none",
  fontSize: "0.85rem",
  padding: "0.35rem 0.7rem",
  border: "1px solid var(--border-glow)",
  borderRadius: 4,
  display: "inline-block",
  textAlign: "center",
};

const inlineLink: React.CSSProperties = {
  color: "var(--green)",
  textDecoration: "none",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.85rem",
};
