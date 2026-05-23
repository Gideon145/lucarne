"use client";

/**
 * /survivor — Survivor Pool GameFi
 *
 * Pick a nation each round. If their momentum score drops below 30, you're eliminated.
 * Last survivor(s) split the pot. Entry fee: 0.001 OKB.
 *
 * Contract: SurvivorPool @ 0x7250E9480A025bF59EedD271DFB88C5BC2f8c12F (X Layer Mainnet)
 */

import { useEffect, useState, useCallback } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  formatEther,
  parseEther,
  toHex,
} from "viem";
import { SURVIVOR_POOL, OKLINK_BASE } from "@/lib/constants";

// ── Chain ─────────────────────────────────────────────────────────────────────

const xlayer = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

// ── ABI ───────────────────────────────────────────────────────────────────────

const ABI = [
  { name: "round",        type: "function", stateMutability: "view",    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "pot",          type: "function", stateMutability: "view",    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "gameOver",     type: "function", stateMutability: "view",    inputs: [], outputs: [{ type: "bool"    }] },
  { name: "getSurvivors", type: "function", stateMutability: "view",    inputs: [], outputs: [{ type: "address[]" }] },
  {
    name: "players",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "pick",    type: "bytes3" },
      { name: "alive",   type: "bool"   },
      { name: "entered", type: "bool"   },
    ],
  },
  {
    name: "enter",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "pick", type: "bytes3" }],
    outputs: [],
  },
  {
    name: "changePick",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPick", type: "bytes3" }],
    outputs: [],
  },
] as const;

// ── Nations available in the signal system ────────────────────────────────────

const NATIONS: { iso3: string; name: string; flag: string }[] = [
  { iso3: "ARG", name: "Argentina",    flag: "🇦🇷" },
  { iso3: "BRA", name: "Brazil",       flag: "🇧🇷" },
  { iso3: "FRA", name: "France",       flag: "🇫🇷" },
  { iso3: "ENG", name: "England",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { iso3: "ESP", name: "Spain",        flag: "🇪🇸" },
  { iso3: "GER", name: "Germany",      flag: "🇩🇪" },
  { iso3: "POR", name: "Portugal",     flag: "🇵🇹" },
  { iso3: "NED", name: "Netherlands",  flag: "🇳🇱" },
  { iso3: "ITA", name: "Italy",        flag: "🇮🇹" },
  { iso3: "URU", name: "Uruguay",      flag: "🇺🇾" },
  { iso3: "COL", name: "Colombia",     flag: "🇨🇴" },
  { iso3: "MEX", name: "Mexico",       flag: "🇲🇽" },
  { iso3: "USA", name: "USA",          flag: "🇺🇸" },
  { iso3: "JAP", name: "Japan",        flag: "🇯🇵" },
  { iso3: "KOR", name: "South Korea",  flag: "🇰🇷" },
  { iso3: "MAR", name: "Morocco",      flag: "🇲🇦" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert 3-char ISO code to bytes3 hex (right-padded with 0x prefix) */
function iso3ToBytes3(iso3: string): `0x${string}` {
  const bytes = new TextEncoder().encode(iso3.toUpperCase().slice(0, 3));
  const hex   = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex.padEnd(6, "0")}` as `0x${string}`;
}

/** Convert bytes3 hex back to 3-char string */
function bytes3ToIso3(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return [0, 2, 4]
    .map(i => String.fromCharCode(parseInt(h.slice(i, i + 2), 16)))
    .join("")
    .replace(/\0/g, "");
}

function short(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PoolState {
  round: number;
  pot: bigint;
  gameOver: boolean;
  survivors: string[];
}

interface PlayerState {
  pick: string;      // ISO3 code
  alive: boolean;
  entered: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SurvivorPage() {
  const [pool,      setPool]      = useState<PoolState | null>(null);
  const [player,    setPlayer]    = useState<PlayerState | null>(null);
  const [wallet,    setWallet]    = useState<string | null>(null);
  const [pick,      setPick]      = useState<string>("ARG");
  const [status,    setStatus]    = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash,    setTxHash]    = useState<string | null>(null);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  // ── Public client (read-only) ───────────────────────────────────────────────
  const publicClient = createPublicClient({ chain: xlayer, transport: http("https://rpc.xlayer.tech") });

  // ── Fetch pool state ────────────────────────────────────────────────────────
  const fetchPool = useCallback(async (walletAddr?: string) => {
    try {
      const [round, pot, gameOver, survivors] = await Promise.all([
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "round" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "pot" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "gameOver" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "getSurvivors" }),
      ]);
      setPool({
        round:    Number(round),
        pot:      pot as bigint,
        gameOver: gameOver as boolean,
        survivors: survivors as string[],
      });

      if (walletAddr) {
        const p = await publicClient.readContract({
          address:      SURVIVOR_POOL,
          abi:          ABI,
          functionName: "players",
          args:         [walletAddr as `0x${string}`],
        }) as readonly [string, boolean, boolean];

        setPlayer({
          pick:    bytes3ToIso3(p[0]),
          alive:   p[1],
          entered: p[2],
        });
      }
    } catch (e) {
      console.error("[survivor] fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPool(); }, [fetchPool]);

  // ── Track wallet account switches ───────────────────────────────────────────
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onChanged = (accounts: string[]) => {
      const addr = accounts[0] ?? null;
      setWallet(addr);
      setStatus("idle");
      setErrMsg(null);
      setTxHash(null);
      setPlayer(null);
      if (addr) fetchPool(addr);
    };
    eth.on("accountsChanged", onChanged);
    return () => eth.removeListener("accountsChanged", onChanged);
  }, [fetchPool]);

  // ── Connect wallet ──────────────────────────────────────────────────────────
  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) { setErrMsg("Install MetaMask or OKX Wallet"); return; }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      setWallet(addr);
      fetchPool(addr);
    } catch (e: any) {
      setErrMsg(e.message ?? "Connect cancelled");
    }
  }

  // ── Enter game ──────────────────────────────────────────────────────────────
  async function enter() {
    const eth = (window as any).ethereum;
    if (!eth || !wallet) return;
    setStatus("pending");
    setErrMsg(null);
    setTxHash(null);
    try {
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });
      const hash = await walletClient.writeContract({
        account:      wallet as `0x${string}`,
        address:      SURVIVOR_POOL,
        abi:          ABI,
        functionName: "enter",
        args:         [iso3ToBytes3(pick)],
        value:        parseEther("0.001"),
      });
      setTxHash(hash);
      setStatus("done");
      setTimeout(() => fetchPool(wallet), 4000);
    } catch (e: any) {
      setErrMsg(e.shortMessage ?? e.message ?? "Transaction failed");
      setStatus("error");
    }
  }

  // ── Change pick ─────────────────────────────────────────────────────────────
  async function changePick() {
    const eth = (window as any).ethereum;
    if (!eth || !wallet) return;
    setStatus("pending");
    setErrMsg(null);
    setTxHash(null);
    try {
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });
      const hash = await walletClient.writeContract({
        account:      wallet as `0x${string}`,
        address:      SURVIVOR_POOL,
        abi:          ABI,
        functionName: "changePick",
        args:         [iso3ToBytes3(pick)],
      });
      setTxHash(hash);
      setStatus("done");
      setTimeout(() => fetchPool(wallet), 4000);
    } catch (e: any) {
      setErrMsg(e.shortMessage ?? e.message ?? "Transaction failed");
      setStatus("error");
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 16,
  };

  const dimLabel: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-dim, #6b7280)",
    letterSpacing: "0.2em",
    marginBottom: 6,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg, #060f09)", color: "var(--text-primary, #e8f5e9)", fontFamily: "var(--font-mono, monospace)", padding: "0 0 60px" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,15,9,0.95)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="/" style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 22, fontWeight: 900, letterSpacing: "0.15em", color: "var(--green, #00ff88)", textDecoration: "none", textShadow: "0 0 16px var(--green-glow, #00ff8844)" }}>
            LUCARNE
          </a>
          <span style={{ fontSize: 10, color: "var(--text-dim, #6b7280)", letterSpacing: "0.2em" }}>
            ▸ SURVIVOR POOL
          </span>
        </div>
        {wallet ? (
          <div style={{ fontSize: 11, color: "var(--green, #00ff88)", letterSpacing: "0.08em" }}>
            ● {short(wallet)}
          </div>
        ) : (
          <button onClick={connectWallet} style={{ padding: "6px 14px", background: "transparent", border: "1px solid var(--green, #00ff88)", borderRadius: 4, color: "var(--green, #00ff88)", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>
            CONNECT WALLET
          </button>
        )}
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>

        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 26, fontWeight: 900, margin: "0 0 8px", letterSpacing: "0.05em" }}>
            SURVIVOR POOL
          </h1>
          <p style={{ color: "var(--text-dim, #9ca3af)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Pick one nation per round. If their momentum score drops below 30, you&apos;re eliminated.
            Last survivor(s) split the pot. Entry: 0.001 OKB.
          </p>
        </div>

        {/* Pool stats */}
        {loading ? (
          <div style={{ ...card, color: "var(--text-dim)" }}>Loading pool state...</div>
        ) : pool ? (
          <div style={{ ...card }}>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <div>
                <div style={dimLabel}>ROUND</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 28, fontWeight: 900, color: "var(--green, #00ff88)" }}>{pool.round}</div>
              </div>
              <div>
                <div style={dimLabel}>POT</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 28, fontWeight: 900, color: "#fbbf24" }}>
                  {parseFloat(formatEther(pool.pot)).toFixed(4)} OKB
                </div>
              </div>
              <div>
                <div style={dimLabel}>SURVIVORS</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 28, fontWeight: 900 }}>{pool.survivors.length}</div>
              </div>
              <div>
                <div style={dimLabel}>STATUS</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: pool.gameOver ? "#ef4444" : "var(--green, #00ff88)", letterSpacing: "0.1em" }}>
                  {pool.gameOver ? "● GAME OVER" : "● LIVE"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* How it works */}
        <div style={{ ...card, borderColor: "rgba(0,255,136,0.12)" }}>
          <div style={dimLabel}>HOW IT WORKS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, lineHeight: 1.7, color: "var(--text-dim, #9ca3af)" }}>
            <span>1. Enter with 0.001 OKB and pick one nation.</span>
            <span>2. Each round, the owner advances the game by calling <code style={{ color: "var(--green, #00ff88)", background: "rgba(0,255,136,0.06)", padding: "1px 4px", borderRadius: 3 }}>nextRound()</code>.</span>
            <span>3. Any player whose nation&apos;s momentum score falls below 30 is eliminated.</span>
            <span>4. You can change your pick before a round ends.</span>
            <span>5. The last survivor(s) claim the entire pot (minus 5% protocol fee).</span>
          </div>
        </div>

        {/* Player status */}
        {player && player.entered && (
          <div style={{ ...card, borderColor: player.alive ? "rgba(0,255,136,0.25)" : "rgba(239,68,68,0.25)" }}>
            <div style={dimLabel}>YOUR STATUS</div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 4 }}>PICK</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 20, fontWeight: 900 }}>
                  {NATIONS.find(n => n.iso3 === player.pick)?.flag ?? ""} {player.pick}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 4 }}>STATUS</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: player.alive ? "var(--green, #00ff88)" : "#ef4444", letterSpacing: "0.12em" }}>
                  {player.alive ? "● ALIVE" : "✕ ELIMINATED"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enter / change pick */}
        {!pool?.gameOver && (
          <div style={card}>
            {!wallet ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <button onClick={connectWallet} style={{ padding: "10px 28px", background: "var(--green, #00ff88)", border: "none", borderRadius: 6, color: "#060f09", fontWeight: 900, fontSize: 13, cursor: "pointer", letterSpacing: "0.08em", fontFamily: "var(--font-mono, monospace)" }}>
                  CONNECT WALLET TO ENTER
                </button>
              </div>
            ) : player?.entered && !player.alive ? (
              <div style={{ textAlign: "center", color: "#ef4444", fontSize: 13, padding: "12px 0", letterSpacing: "0.1em" }}>
                YOU HAVE BEEN ELIMINATED
              </div>
            ) : (
              <>
                <div style={dimLabel}>{player?.entered ? "CHANGE YOUR PICK" : "ENTER THE POOL — 0.001 OKB"}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  <select
                    value={pick}
                    onChange={e => setPick(e.target.value)}
                    style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "var(--text-primary, #e8f5e9)", fontFamily: "var(--font-mono, monospace)", fontSize: 13, minWidth: 180, cursor: "pointer" }}
                  >
                    {NATIONS.map(n => (
                      <option key={n.iso3} value={n.iso3} style={{ background: "#0d1f12" }}>
                        {n.flag} {n.iso3} — {n.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={player?.entered ? changePick : enter}
                    disabled={status === "pending"}
                    style={{ padding: "9px 22px", background: "var(--green, #00ff88)", border: "none", borderRadius: 6, color: "#060f09", fontWeight: 900, fontSize: 12, cursor: status === "pending" ? "not-allowed" : "pointer", letterSpacing: "0.08em", fontFamily: "var(--font-mono, monospace)", opacity: status === "pending" ? 0.6 : 1 }}
                  >
                    {status === "pending"
                      ? "PENDING…"
                      : player?.entered
                      ? "UPDATE PICK"
                      : "ENTER · 0.001 OKB"}
                  </button>
                </div>

                {txHash && (
                  <div style={{ fontSize: 11, color: "var(--green, #00ff88)" }}>
                    ✓ TX:{" "}
                    <a href={`${OKLINK_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--green, #00ff88)" }}>
                      {txHash.slice(0, 18)}…
                    </a>
                  </div>
                )}
                {errMsg && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{errMsg}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Survivor list */}
        {pool && pool.survivors.length > 0 && (
          <div style={card}>
            <div style={dimLabel}>CURRENT SURVIVORS ({pool.survivors.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pool.survivors.slice(0, 20).map(addr => (
                <div key={addr} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <a
                    href={`${OKLINK_BASE}/address/${addr}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: addr.toLowerCase() === wallet?.toLowerCase() ? "var(--green, #00ff88)" : "var(--text-dim, #9ca3af)", textDecoration: "none" }}
                  >
                    {addr.toLowerCase() === wallet?.toLowerCase() ? "● YOU — " : ""}{short(addr)}
                  </a>
                  <span style={{ fontSize: 10, color: "var(--green, #00ff88)" }}>ALIVE</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game over state */}
        {pool?.gameOver && pool.survivors.length > 0 && (
          <div style={{ ...card, borderColor: "#fbbf24", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 18, fontWeight: 900, color: "#fbbf24", marginBottom: 12 }}>
              🏆 GAME OVER
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              {pool.survivors.length === 1 ? "Last survivor wins the pot." : `${pool.survivors.length} survivors split the pot.`}
            </div>
            {pool.survivors.map(addr => (
              <div key={addr} style={{ fontSize: 12, color: "#fbbf24" }}>
                🏆 {short(addr)}
              </div>
            ))}
          </div>
        )}

        {/* Footer links */}
        <div style={{ fontSize: 10, color: "var(--text-dim, #6b7280)", letterSpacing: "0.12em", marginTop: 8 }}>
          <a href={`${OKLINK_BASE}/address/${SURVIVOR_POOL}`} target="_blank" rel="noreferrer" style={{ color: "var(--green, #00ff88)", textDecoration: "none" }}>
            CONTRACT ↗
          </a>
          {"  ·  "}
          <a href="/leaderboard" style={{ color: "var(--text-dim, #6b7280)", textDecoration: "none" }}>
            LEADERBOARD ↗
          </a>
          {"  ·  NOT FINANCIAL ADVICE · 18+ · SELF-CUSTODIAL"}
        </div>
      </div>
    </main>
  );
}
