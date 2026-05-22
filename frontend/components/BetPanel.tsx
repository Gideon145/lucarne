"use client";

import { useEffect, useState, useCallback } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  keccak256,
  toBytes,
  parseEther,
  formatEther,
} from "viem";
import { SIGNAL_POOL, OKLINK_BASE, AGENT_WALLET } from "@/lib/constants";

// ── ABIs ──────────────────────────────────────────────────────────────────────

const POOL_READ_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "gameId", type: "bytes32" }],
    outputs: [
      { name: "homeBucket",      type: "uint256" },
      { name: "drawBucket",      type: "uint256" },
      { name: "awayBucket",      type: "uint256" },
      { name: "agentStakeAmount",type: "uint256" },
      { name: "agentCall",       type: "uint8"   },
      { name: "open",            type: "bool"    },
      { name: "settled",         type: "bool"    },
      { name: "winOutcome",      type: "uint8"   },
    ],
  },
  {
    name: "deadlines",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "gameId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUserStake",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "gameId", type: "bytes32" }, { name: "outcome", type: "uint8" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const POOL_WRITE_ABI = [
  {
    name: "bet",
    type: "function",
    stateMutability: "payable",
    inputs:  [{ name: "gameId", type: "bytes32" }, { name: "outcome", type: "uint8" }],
    outputs: [],
  },
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "gameId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "gameId", type: "bytes32" }],
    outputs: [],
  },
] as const;

// ── Chain ─────────────────────────────────────────────────────────────────────

const xlayer = {
  id:   196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PoolState {
  homeBucket: bigint;
  drawBucket: bigint;
  awayBucket: bigint;
  agentStake: bigint;
  agentCall: number;
  open: boolean;
  settled: boolean;
  winOutcome: number;
  deadline: bigint;
  userStakes: [bigint, bigint, bigint];
}

const OUTCOME_LABELS = ["HOME", "DRAW", "AWAY"] as const;
const OUTCOME_COLORS = ["var(--text-primary)", "var(--amber)", "var(--green)"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(wei: bigint): string {
  const e = formatEther(wei);
  const n = parseFloat(e);
  if (n === 0) return "0";
  if (n < 0.001) return "< 0.001";
  return n.toFixed(3);
}

function pct(part: bigint, total: bigint): string {
  if (total === 0n) return "—";
  return ((Number(part) / Number(total)) * 100).toFixed(1) + "%";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BetPanel({
  slug, home, away,
}: {
  slug: string;
  home: string;
  away: string;
}) {
  const [pool,      setPool]      = useState<PoolState | null>(null);
  const [wallet,    setWallet]    = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("0.01");
  const [status,    setStatus]    = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash,    setTxHash]    = useState<string | null>(null);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);

  const gameId = keccak256(toBytes(slug)) as `0x${string}`;

  const publicClient = createPublicClient({
    chain:     xlayer,
    transport: http("https://rpc.xlayer.tech"),
  });

  // ── Fetch pool state ───────────────────────────────────────────────────────

  const fetchPool = useCallback(async (addr?: string) => {
    try {
      const [poolResult, deadlineResult] = await Promise.all([
        publicClient.readContract({
          address:      SIGNAL_POOL,
          abi:          POOL_READ_ABI,
          functionName: "getPool",
          args:         [gameId],
        }),
        publicClient.readContract({
          address:      SIGNAL_POOL,
          abi:          POOL_READ_ABI,
          functionName: "deadlines",
          args:         [gameId],
        }),
      ]);

      const [homeBucket, drawBucket, awayBucket, agentStake, agentCall, open, settled, winOutcome] = poolResult as [bigint, bigint, bigint, bigint, number, boolean, boolean, number];
      const deadline = deadlineResult as bigint;

      let userStakes: [bigint, bigint, bigint] = [0n, 0n, 0n];
      if (addr && open) {
        const [u0, u1, u2] = await Promise.all([
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 0, addr as `0x${string}`] }),
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 1, addr as `0x${string}`] }),
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 2, addr as `0x${string}`] }),
        ]);
        userStakes = [u0 as bigint, u1 as bigint, u2 as bigint];
      }

      setPool({ homeBucket, drawBucket, awayBucket, agentStake, agentCall, open, settled, winOutcome, deadline, userStakes });
    } catch {
      // Pool not yet open for this game — show "opening soon" state
      setPool(null);
    }
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPool(wallet ?? undefined); }, [fetchPool, wallet]);

  // Watch wallet account switches
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const handler = (accounts: string[]) => {
      setWallet(accounts[0] ?? null);
      setStatus("idle");
      setErrMsg(null);
      setTxHash(null);
    };
    eth.on("accountsChanged", handler);
    return () => eth.removeListener("accountsChanged", handler);
  }, []);

  // ── Connect wallet ──────────────────────────────────────────────────────────

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) { setErrMsg("No wallet detected — install MetaMask or OKX Wallet"); return; }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0] ?? null);
      await fetchPool(accounts[0] ?? undefined);
    } catch {
      setErrMsg("Wallet connection rejected");
    }
  }

  // ── Place bet ───────────────────────────────────────────────────────────────

  async function placeBet(outcome: number) {
    if (!wallet) return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    setStatus("pending");
    setErrMsg(null);
    setTxHash(null);

    try {
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });

      // Pending nonce fix for X Layer
      const nonce = await publicClient.getTransactionCount({ address: wallet as `0x${string}`, blockTag: "pending" });

      const value = parseEther(betAmount);
      const hash = await walletClient.writeContract({
        address:      SIGNAL_POOL,
        abi:          POOL_WRITE_ABI,
        functionName: "bet",
        args:         [gameId, outcome],
        account:      wallet as `0x${string}`,
        value,
        nonce,
      });

      setTxHash(hash);
      setStatus("done");
      // Refresh pool state after a short delay
      setTimeout(() => fetchPool(wallet), 4000);
    } catch (e: any) {
      setStatus("error");
      const raw = e?.shortMessage ?? e?.message ?? "Transaction failed";
      setErrMsg(raw.length > 120 ? raw.slice(0, 120) + "…" : raw);
    }
  }

  // ── Deadline countdown ──────────────────────────────────────────────────────

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!pool?.deadline) return;
    const update = () => {
      const diff = Number(pool.deadline) - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setTimeLeft("CLOSED"); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [pool?.deadline]);

  // ── Render: pool not open ──────────────────────────────────────────────────

  if (!pool || !pool.open) {
    return (
      <div style={{
        border: "1px solid var(--border)",
        padding: "28px 32px",
        marginBottom: 32,
        background: "rgba(6,15,9,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--text-faint)",
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 6 }}>
            SIGNAL POOL — OPENING BEFORE KICKOFF
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.7 }}>
            Lucarne will stake OKB on its own signal call before kickoff.{" "}
            When the pool opens, you can take the other side — or back the same call.{" "}
            All outcomes settle automatically from on-chain match results.
          </div>
        </div>
      </div>
    );
  }

  const total = pool.homeBucket + pool.drawBucket + pool.awayBucket;
  const buckets = [pool.homeBucket, pool.drawBucket, pool.awayBucket];
  const kickoffPassed = pool.deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) >= pool.deadline;
  const canBet = pool.open && !pool.settled && !kickoffPassed;

  // ── Render: pool open ──────────────────────────────────────────────────────

  return (
    <div style={{ border: "1px solid rgba(0,255,133,0.3)", marginBottom: 32, background: "rgba(6,15,9,0.5)" }}>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 28px",
        borderBottom: "1px solid rgba(0,255,133,0.2)",
        background: "rgba(0,255,133,0.04)",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: canBet ? "var(--green)" : "var(--text-faint)",
            boxShadow: canBet ? "0 0 8px var(--green)" : "none",
            animation: canBet ? "pulse 1.4s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "var(--green)" }}>
            {pool.settled ? "POOL SETTLED" : canBet ? "SIGNAL POOL — LIVE" : "POOL CLOSED · AWAITING SETTLEMENT"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {!pool.settled && pool.deadline > 0n && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
              {canBet ? `CLOSES IN ${timeLeft}` : `KICKOFF PASSED`}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono), monospace" }}>
            POT: {fmt(total)} OKB
          </span>
          <a
            href={`${OKLINK_BASE}/address/${SIGNAL_POOL}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}
          >
            CONTRACT ↗
          </a>
        </div>
      </div>

      <div style={{ padding: "28px 28px" }}>

        {/* Agent stake callout */}
        <div style={{
          border: "1px solid rgba(0,255,133,0.25)",
          padding: "16px 20px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          background: "rgba(0,255,133,0.03)",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 4 }}>
              LUCARNE AGENT STAKED
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 22, fontWeight: 900, color: "var(--green)", letterSpacing: "0.05em" }}>
              {fmt(pool.agentStake)} OKB
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: "var(--border)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 4 }}>
              ON OUTCOME
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 16, fontWeight: 700, color: "var(--green)" }}>
              {OUTCOME_LABELS[pool.agentCall]}
              {pool.agentCall === 0 ? ` (${home})` : pool.agentCall === 2 ? ` (${away})` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.7, maxWidth: 300 }}>
            Signal is bonded. If Lucarne is wrong, its stake goes to winning bettors.
          </div>
        </div>

        {/* Pool buckets */}
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", marginBottom: 28 }}>
          {([
            { label: `${home} WIN`, bucket: pool.homeBucket, outcome: 0 },
            { label: "DRAW",        bucket: pool.drawBucket,  outcome: 1 },
            { label: `${away} WIN`, bucket: pool.awayBucket,  outcome: 2 },
          ] as const).map(({ label, bucket, outcome }, i) => {
            const isAgentCall = outcome === pool.agentCall;
            const userAmt = pool.userStakes[outcome];
            return (
              <div
                key={label}
                style={{
                  flex: 1,
                  padding: "20px 16px",
                  textAlign: "center",
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  borderTop: isAgentCall ? "3px solid var(--green)" : pool.settled && outcome === pool.winOutcome ? "3px solid var(--amber)" : "3px solid transparent",
                  background: isAgentCall ? "rgba(0,255,133,0.04)" : "transparent",
                }}
              >
                <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 22, fontWeight: 900, color: isAgentCall ? "var(--green)" : "var(--text-dim)", marginBottom: 4 }}>
                  {fmt(bucket)} OKB
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 4 }}>
                  {pct(bucket, total)} of pot
                </div>
                <div style={{ fontSize: 11, color: isAgentCall ? "var(--green)" : "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", marginBottom: 8 }}>
                  {label}
                  {isAgentCall && <span style={{ marginLeft: 6, color: "var(--green)" }}>← LUCARNE</span>}
                </div>
                {pool.settled && outcome === pool.winOutcome && (
                  <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em" }}>
                    ✓ WINNER
                  </div>
                )}
                {userAmt > 0n && (
                  <div style={{ fontSize: 10, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", marginTop: 4 }}>
                    your stake: {fmt(userAmt)} OKB
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bet / Connect / Claim UI */}
        {pool.settled ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            {(() => {
              const winnerBucket = [pool.homeBucket, pool.drawBucket, pool.awayBucket][pool.winOutcome];
              const userWinStake = pool.userStakes[pool.winOutcome];
              const payout = winnerBucket > 0n && total > 0n
                ? (userWinStake * total) / winnerBucket
                : 0n;

              if (userWinStake > 0n) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 14, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em" }}>
                      YOU WON · ESTIMATED PAYOUT: {fmt(payout)} OKB
                    </div>
                    <ClaimButton gameId={gameId} wallet={wallet} connectWallet={connectWallet} />
                  </div>
                );
              }
              return (
                <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
                  Pool settled. Winner: <strong style={{ color: "var(--amber)" }}>{OUTCOME_LABELS[pool.winOutcome]}</strong>
                </div>
              );
            })()}
          </div>
        ) : canBet ? (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 16 }}>
              PLACE YOUR BET (OKB)
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <input
                type="number"
                min="0.001"
                step="0.005"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                style={{
                  width: 120,
                  padding: "10px 14px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 14,
                  borderRadius: 4,
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>OKB</span>
              {["0.005", "0.01", "0.05", "0.1"].map(v => (
                <button
                  key={v}
                  onClick={() => setBetAmount(v)}
                  style={{
                    padding: "6px 12px",
                    background: betAmount === v ? "rgba(0,255,133,0.1)" : "transparent",
                    border: `1px solid ${betAmount === v ? "var(--green)" : "var(--border)"}`,
                    color: betAmount === v ? "var(--green)" : "var(--text-faint)",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 11,
                    cursor: "pointer",
                    borderRadius: 3,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            {!wallet ? (
              <button
                onClick={connectWallet}
                style={{
                  padding: "12px 28px",
                  background: "transparent",
                  border: "1px solid var(--green)",
                  color: "var(--green)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                CONNECT WALLET TO BET
              </button>
            ) : (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {([
                  { label: `${home.toUpperCase()} WIN`, outcome: 0, color: "var(--text-primary)" },
                  { label: "DRAW",                      outcome: 1, color: "var(--amber)" },
                  { label: `${away.toUpperCase()} WIN`, outcome: 2, color: "var(--green)" },
                ] as const).map(({ label, outcome, color }) => (
                  <button
                    key={outcome}
                    onClick={() => placeBet(outcome)}
                    disabled={status === "pending"}
                    style={{
                      padding: "12px 24px",
                      background: outcome === pool.agentCall ? "rgba(0,255,133,0.08)" : "transparent",
                      border: `1px solid ${color}`,
                      color,
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 12,
                      letterSpacing: "0.1em",
                      cursor: status === "pending" ? "not-allowed" : "pointer",
                      opacity: status === "pending" ? 0.5 : 1,
                    }}
                  >
                    BET {label}
                    {outcome === pool.agentCall && <span style={{ marginLeft: 6, opacity: 0.7 }}>← SIGNAL</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textAlign: "center", padding: "12px 0" }}>
            Kickoff passed · Pool awaiting settlement once result is on-chain
          </div>
        )}

        {/* TX / error feedback */}
        {status === "pending" && (
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>
            Sending tx…
          </div>
        )}
        {status === "done" && txHash && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--green)", fontFamily: "var(--font-mono), monospace" }}>✓ BET PLACED</span>
            <a
              href={`${OKLINK_BASE}/tx/${txHash}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none", border: "1px solid var(--green)", padding: "4px 10px" }}
            >
              TX ↗
            </a>
          </div>
        )}
        {status === "error" && errMsg && (
          <div style={{ marginTop: 16, fontSize: 12, color: "#e05252", fontFamily: "var(--font-mono), monospace" }}>
            {errMsg}
          </div>
        )}

        {/* Wallet info */}
        {wallet && (
          <div style={{ marginTop: 16, fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
            {wallet.slice(0, 10)}…{wallet.slice(-6)} connected ·{" "}
            {AGENT_WALLET.toLowerCase() === wallet.toLowerCase() ? "Agent wallet" : "Your wallet"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Claim button (separate to keep bet panel clean) ───────────────────────────

function ClaimButton({ gameId, wallet, connectWallet }: { gameId: `0x${string}`; wallet: string | null; connectWallet: () => void }) {
  const [status,  setStatus]  = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash,  setTxHash]  = useState<string | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  const CLAIM_ABI = [
    { name: "claim", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "gameId", type: "bytes32" }], outputs: [] },
  ] as const;

  async function claim() {
    if (!wallet) return;
    const eth = (window as any).ethereum;
    if (!eth) return;
    setStatus("pending");
    try {
      const publicClient = createPublicClient({ chain: xlayer, transport: http("https://rpc.xlayer.tech") });
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });
      const nonce = await publicClient.getTransactionCount({ address: wallet as `0x${string}`, blockTag: "pending" });
      const hash = await walletClient.writeContract({
        address: SIGNAL_POOL, abi: CLAIM_ABI, functionName: "claim",
        args: [gameId], account: wallet as `0x${string}`, nonce,
      });
      setTxHash(hash);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.shortMessage ?? "Claim failed");
    }
  }

  if (!wallet) {
    return (
      <button onClick={connectWallet} style={{ padding: "12px 28px", background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", fontFamily: "var(--font-mono), monospace", fontSize: 13, cursor: "pointer" }}>
        CONNECT WALLET TO CLAIM
      </button>
    );
  }
  if (status === "done" && txHash) {
    return (
      <a href={`${OKLINK_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
        style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none", border: "1px solid var(--green)", padding: "10px 20px" }}>
        ✓ CLAIMED · TX ↗
      </a>
    );
  }
  return (
    <div>
      <button onClick={claim} disabled={status === "pending"}
        style={{ padding: "12px 28px", background: "rgba(255,180,0,0.08)", border: "1px solid var(--amber)", color: "var(--amber)", fontFamily: "var(--font-mono), monospace", fontSize: 13, cursor: status === "pending" ? "not-allowed" : "pointer", opacity: status === "pending" ? 0.5 : 1 }}>
        {status === "pending" ? "CLAIMING…" : "CLAIM WINNINGS"}
      </button>
      {status === "error" && errMsg && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#e05252", fontFamily: "var(--font-mono), monospace" }}>{errMsg}</div>
      )}
    </div>
  );
}
