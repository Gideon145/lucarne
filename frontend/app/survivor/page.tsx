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
import { HOT_SEAT_POOL, OKLINK_BASE } from "@/lib/constants";

const SURVIVOR_POOL = HOT_SEAT_POOL; // HotSeatPool — lowest momentum nation cut each round

// ── Chain ─────────────────────────────────────────────────────────────────────

const xlayer = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

// ── ABI ───────────────────────────────────────────────────────────────────────

const ABI = [
  { name: "round",         type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "pot",           type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "gameOver",      type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool"    }] },
  { name: "getSurvivors",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
  { name: "lastHotSeat",   type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes3"   }] },
  { name: "lastHotScore",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8"    }] },
  { name: "playerCount",   type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
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
  {
    name: "playerList",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "address" }],
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

// ── ISO3 → ISO2 map (for flagcdn.com) ────────────────────────────────────────

const ISO3_TO_ISO2: Record<string, string> = {
  ARG: "ar", BRA: "br", FRA: "fr", ENG: "gb-eng", ESP: "es",
  GER: "de", POR: "pt", NED: "nl", ITA: "it",  URU: "uy",
  COL: "co", MEX: "mx", USA: "us", JAP: "jp",  KOR: "kr", MAR: "ma",
};

function FlagBadge({ iso3, size = "md" }: { iso3: string; size?: "sm" | "md" | "lg" }) {
  const iso2 = ISO3_TO_ISO2[iso3] ?? iso3.toLowerCase().slice(0, 2);
  const nation = NATIONS.find(n => n.iso3 === iso3);
  const imgW = size === "lg" ? 36 : size === "sm" ? 18 : 28;
  const fontSize = size === "lg" ? 18 : size === "sm" ? 11 : 15;
  const pad = size === "lg" ? "8px 14px" : size === "sm" ? "3px 8px" : "6px 12px";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.22)", borderRadius: 8, padding: pad }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w40/${iso2}.png`}
        alt={nation?.name ?? iso3}
        width={imgW}
        style={{ borderRadius: 3, display: "block", objectFit: "cover" }}
      />
      <span style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize, fontWeight: 900, letterSpacing: "0.08em" }}>
        {iso3}
      </span>
    </span>
  );
}

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
  lastHotSeat: string;  // ISO3 of nation cut last round
  lastHotScore: number;
  playerCount: number;
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
  const [nationTally, setNationTally] = useState<Record<string, number>>({});

  // ── Public client (read-only) ───────────────────────────────────────────────
  const publicClient = createPublicClient({ chain: xlayer, transport: http("https://rpc.xlayer.tech") });

  // ── Fetch pool state ────────────────────────────────────────────────────────
  const fetchPool = useCallback(async (walletAddr?: string) => {
    try {
      const [round, pot, gameOver, survivors, lastHotSeat, lastHotScore, playerCount] = await Promise.all([
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "round" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "pot" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "gameOver" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "getSurvivors" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "lastHotSeat" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "lastHotScore" }),
        publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "playerCount" }),
      ]);
      const hotSeatIso3 = bytes3ToIso3(lastHotSeat as string);

      // Build nation tally from all player picks
      const count = Number(playerCount);
      const tally: Record<string, number> = {};
      if (count > 0) {
        const cap = Math.min(count, 60);
        const addrs = await Promise.all(
          Array.from({ length: cap }, (_, i) =>
            publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "playerList", args: [BigInt(i)] })
          )
        ) as string[];
        const picks = await Promise.all(
          addrs.map(addr =>
            publicClient.readContract({ address: SURVIVOR_POOL, abi: ABI, functionName: "players", args: [addr as `0x${string}`] })
          )
        ) as readonly [string, boolean, boolean][];
        picks.forEach(p => {
          if (p[2]) {
            const iso3 = bytes3ToIso3(p[0]);
            if (iso3) tally[iso3] = (tally[iso3] ?? 0) + 1;
          }
        });
      }
      setNationTally(tally);

      setPool({
        round:        Number(round),
        pot:          pot as bigint,
        gameOver:     gameOver as boolean,
        survivors:    survivors as string[],
        lastHotSeat:  hotSeatIso3,
        lastHotScore: Number(lastHotScore),
        playerCount:  Number(playerCount),
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
    background: "rgba(0,255,136,0.04)",
    border: "1px solid rgba(0,255,136,0.11)",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 16,
    backdropFilter: "blur(6px)",
  };

  const dimLabel: React.CSSProperties = {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.2em",
    marginBottom: 6,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={{
      minHeight: "100vh",
      background: [
        "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(0,255,136,0.08) 0%, transparent 65%)",
        "repeating-linear-gradient(180deg, rgba(0,50,0,0.52) 0px, rgba(0,50,0,0.52) 56px, rgba(0,30,0,0.38) 56px, rgba(0,30,0,0.38) 112px)",
        "#050e07",
      ].join(", "),
      color: "var(--text-primary, #e8f5e9)",
      fontFamily: "var(--font-mono, monospace)",
      padding: "0 0 60px",
    }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,15,9,0.95)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="/" style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 22, fontWeight: 900, letterSpacing: "0.15em", color: "var(--green, #00ff88)", textDecoration: "none", textShadow: "0 0 16px var(--green-glow, #00ff8844)" }}>
            LUCARNE
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em" }}>
            ▸ HOT SEAT POOL
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

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "32px 24px", display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 32, fontWeight: 900, margin: "0 0 10px", letterSpacing: "0.05em", color: "#fff" }}>
            HOT SEAT POOL
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Each round the nation with the <span style={{ color: "#ef4444", fontWeight: 700 }}>lowest momentum score</span> gets torched.
            If you picked them — you&apos;re out. Last survivor(s) split the pot. Entry: 0.001 OKB.
          </p>
        </div>

        {/* Pool stats */}
        {loading ? (
          <div style={{ ...card, color: "var(--text-dim)" }}>Loading pool state...</div>
        ) : pool ? (
          <div style={{ ...card }}>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <div style={dimLabel}>ROUND</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 36, fontWeight: 900, color: "var(--green, #00ff88)" }}>{pool.round}</div>
              </div>
              <div>
                <div style={dimLabel}>POT</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 36, fontWeight: 900, color: "#fbbf24" }}>
                  {parseFloat(formatEther(pool.pot)).toFixed(4)} OKB
                </div>
              </div>
              <div>
                <div style={dimLabel}>SURVIVORS</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 36, fontWeight: 900 }}>{pool.survivors.length}</div>
              </div>
              <div>
                <div style={dimLabel}>PLAYERS</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 36, fontWeight: 900, color: "var(--text-dim, #9ca3af)" }}>{pool.playerCount}</div>
              </div>
              <div>
                <div style={dimLabel}>STATUS</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: pool.gameOver ? "#ef4444" : "var(--green, #00ff88)", letterSpacing: "0.12em" }}>
                  {pool.gameOver ? "● GAME OVER" : "● LIVE"}
                </div>
              </div>
            </div>
            {pool.lastHotSeat && pool.round > 1 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.18em" }}>LAST HOT SEAT</span>
                <FlagBadge iso3={pool.lastHotSeat} size="sm" />
                <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>score {pool.lastHotScore}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* How it works */}
        <div style={{ ...card, borderColor: "rgba(0,255,136,0.12)" }}>
          <div style={dimLabel}>HOW IT WORKS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,0.7)" }}>
            <span>1. Enter with 0.001 OKB and pick one nation.</span>
            <span>2. The owner calls <code style={{ color: "var(--green, #00ff88)", background: "rgba(0,255,136,0.06)", padding: "1px 5px", borderRadius: 3 }}>nextRound()</code> after each World Cup match day.</span>
            <span>3. The nation with the <span style={{ color: "#ef4444", fontWeight: 700 }}>lowest momentum score</span> that round goes in the hot seat — all pickers get eliminated.</span>
            <span>4. You can change your pick at any time before the round closes.</span>
            <span>5. Last survivor(s) claim the entire pot (minus 5% protocol fee).</span>
          </div>
        </div>

        {/* Player status */}
        {player && player.entered && (
          <div style={{ ...card, borderColor: player.alive ? "rgba(0,255,136,0.25)" : "rgba(239,68,68,0.25)" }}>
            <div style={dimLabel}>YOUR STATUS</div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 4 }}>PICK</div>
                <FlagBadge iso3={player.pick} size="md" />
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
                        {n.iso3} — {n.name}
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
                    style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: addr.toLowerCase() === wallet?.toLowerCase() ? "var(--green, #00ff88)" : "rgba(255,255,255,0.6)", textDecoration: "none" }}
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
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginTop: 8 }}>
          <a href={`${OKLINK_BASE}/address/${SURVIVOR_POOL}`} target="_blank" rel="noreferrer" style={{ color: "var(--green, #00ff88)", textDecoration: "none" }}>
            CONTRACT ↗
          </a>
          {"  ·  "}
          <a href="/leaderboard" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
            LEADERBOARD ↗
          </a>
          {"  ·  NOT FINANCIAL ADVICE · 18+ · SELF-CUSTODIAL"}
        </div>
        </div>{/* end left col */}

        {/* Right: nation tally sidebar */}
        <div style={{ width: 190, flexShrink: 0, position: "sticky", top: 80 }}>
          <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.13)", borderRadius: 10, padding: "16px", backdropFilter: "blur(6px)" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", marginBottom: 14 }}>NATIONS IN POOL</div>
            {Object.keys(nationTally).length === 0 ? (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>No entries yet. Opens at kickoff.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(nationTally)
                  .sort((a, b) => b[1] - a[1])
                  .map(([iso3, cnt]) => (
                    <div key={iso3} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <FlagBadge iso3={iso3} size="sm" />
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontFamily: "var(--font-orbitron, sans-serif)" }}>×{cnt}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
