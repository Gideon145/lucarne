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
      { name: "homeBucket",       type: "uint256" },
      { name: "drawBucket",       type: "uint256" },
      { name: "awayBucket",       type: "uint256" },
      { name: "agentStakeAmount", type: "uint256" },
      { name: "agentCall",        type: "uint8"   },
      { name: "open",             type: "bool"    },
      { name: "settled",          type: "bool"    },
      { name: "winOutcome",       type: "uint8"   },
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
    inputs:  [
      { name: "gameId",  type: "bytes32" },
      { name: "outcome", type: "uint8"   },
      { name: "user",    type: "address" },
    ],
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(wei: bigint): string {
  const n = parseFloat(formatEther(wei));
  if (n === 0) return "0";
  if (n < 0.001) return "< 0.001";
  return n.toFixed(3);
}

function pct(part: bigint, total: bigint): string {
  if (total === 0n) return "—";
  return ((Number(part) / Number(total)) * 100).toFixed(1) + "%";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BetPanel({ slug, home, away }: { slug: string; home: string; away: string }) {
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
      const [poolResult, deadline] = await Promise.all([
        publicClient.readContract({
          address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getPool", args: [gameId],
        }),
        publicClient.readContract({
          address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "deadlines", args: [gameId],
        }),
      ]);

      const [homeBucket, drawBucket, awayBucket, agentStake, agentCall, open, settled, winOutcome] =
        poolResult as [bigint, bigint, bigint, bigint, number, boolean, boolean, number];

      let userStakes: [bigint, bigint, bigint] = [0n, 0n, 0n];
      if (addr && open) {
        const [u0, u1, u2] = await Promise.all([
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 0, addr as `0x${string}`] }),
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 1, addr as `0x${string}`] }),
          publicClient.readContract({ address: SIGNAL_POOL, abi: POOL_READ_ABI, functionName: "getUserStake", args: [gameId, 2, addr as `0x${string}`] }),
        ]);
        userStakes = [u0 as bigint, u1 as bigint, u2 as bigint];
      }

      setPool({ homeBucket, drawBucket, awayBucket, agentStake, agentCall, open, settled, winOutcome, deadline: deadline as bigint, userStakes });
    } catch {
      setPool(null);
    }
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPool(wallet ?? undefined); }, [fetchPool, wallet]);

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

  // ── Place bet — no nonce override, let the wallet manage it ────────────────

  async function placeBet(outcome: number) {
    if (!wallet) return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    setStatus("pending");
    setErrMsg(null);
    setTxHash(null);

    try {
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });

      const hash = await walletClient.writeContract({
        address:      SIGNAL_POOL,
        abi:          POOL_WRITE_ABI,
        functionName: "bet",
        args:         [gameId, outcome],
        account:      wallet as `0x${string}`,
        value:        parseEther(betAmount),
        // No nonce override — wallet (MetaMask / OKX) manages its own nonce
      });

      setTxHash(hash);
      setStatus("done");
      setTimeout(() => fetchPool(wallet), 4000);
    } catch (e: any) {
      setStatus("error");
      const raw = e?.shortMessage ?? e?.message ?? "Transaction failed";
      setErrMsg(raw.length > 140 ? raw.slice(0, 140) + "..." : raw);
    }
  }

  // ── Countdown ──────────────────────────────────────────────────────────────

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

  // ── Render: pool not open yet ──────────────────────────────────────────────

  if (!pool || !pool.open) {
    return (
      <div style={{
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "28px 32px",
        marginBottom: 32,
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, color: "#f0b429", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 8, fontWeight: 700 }}>
            SIGNAL POOL — OPENING BEFORE KICKOFF
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
            Lucarne will stake OKB on its own signal before kickoff.
            When open, you can back or oppose the call — all settled from on-chain results.
          </div>
        </div>
      </div>
    );
  }

  const total = pool.homeBucket + pool.drawBucket + pool.awayBucket;
  const kickoffPassed = pool.deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) >= pool.deadline;
  const canBet = pool.open && !pool.settled && !kickoffPassed;

  const bucketDefs = [
    { label: `${home.toUpperCase()} WIN`, bucket: pool.homeBucket, outcome: 0 as const },
    { label: "DRAW",                       bucket: pool.drawBucket,  outcome: 1 as const },
    { label: `${away.toUpperCase()} WIN`,  bucket: pool.awayBucket,  outcome: 2 as const },
  ];

  // ── Render: pool open ──────────────────────────────────────────────────────

  return (
    <div style={{
      border: "2px solid rgba(255,255,255,0.25)",
      marginBottom: 32,
      background: "rgba(10,18,12,0.85)",
      boxShadow: "0 0 40px rgba(0,255,133,0.06)",
    }}>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: canBet ? "#00ff85" : "rgba(255,255,255,0.3)",
            boxShadow: canBet ? "0 0 10px #00ff85" : "none",
          }} />
          <span style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: canBet ? "#00ff85" : "rgba(255,255,255,0.5)",
          }}>
            {pool.settled ? "POOL SETTLED" : canBet ? "SIGNAL POOL — LIVE" : "POOL CLOSED · AWAITING SETTLEMENT"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {!pool.settled && pool.deadline > 0n && (
            <span style={{ fontSize: 13, color: canBet ? "#f0b429" : "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>
              {canBet ? `CLOSES IN ${timeLeft}` : "KICKOFF PASSED"}
            </span>
          )}
          <span style={{ fontSize: 13, color: "#f0b429", fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>
            POT: {fmt(total)} OKB
          </span>
          <a
            href={`${OKLINK_BASE}/address/${SIGNAL_POOL}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}
          >
            CONTRACT ↗
          </a>
        </div>
      </div>

      <div style={{ padding: "28px 28px" }}>

        {/* Agent stake banner */}
        <div style={{
          border: "1px solid rgba(0,255,133,0.35)",
          padding: "20px 24px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          background: "rgba(0,255,133,0.06)",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 6 }}>
              LUCARNE AGENT STAKED
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 28, fontWeight: 900, color: "#00ff85", letterSpacing: "0.04em", lineHeight: 1 }}>
              {fmt(pool.agentStake)} OKB
            </div>
          </div>
          <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 6 }}>
              ON OUTCOME
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {OUTCOME_LABELS[pool.agentCall]}
              {pool.agentCall === 0 ? ` · ${home}` : pool.agentCall === 2 ? ` · ${away}` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.75, maxWidth: 280 }}>
            Agent is a participant — not the house. Wrong signal means its stake goes to winning bettors.
          </div>
        </div>

        {/* Pool buckets */}
        <div style={{ display: "flex", gap: 0, border: "1px solid rgba(255,255,255,0.12)", marginBottom: 28 }}>
          {bucketDefs.map(({ label, bucket, outcome }, i) => {
            const isAgentCall = outcome === pool.agentCall;
            const isWinner    = pool.settled && outcome === pool.winOutcome;
            const userAmt     = pool.userStakes[outcome];
            return (
              <div
                key={label}
                style={{
                  flex: 1,
                  padding: "24px 16px",
                  textAlign: "center",
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  borderTop: isAgentCall ? "3px solid #00ff85" : isWinner ? "3px solid #f0b429" : "3px solid transparent",
                  background: isAgentCall ? "rgba(0,255,133,0.07)" : isWinner ? "rgba(240,180,41,0.06)" : "transparent",
                }}
              >
                <div style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  fontSize: 22,
                  fontWeight: 900,
                  color: isAgentCall ? "#00ff85" : isWinner ? "#f0b429" : "#fff",
                  marginBottom: 6,
                  lineHeight: 1,
                }}>
                  {fmt(bucket)}
                  <span style={{ fontSize: 13, marginLeft: 4, fontWeight: 400, opacity: 0.7 }}>OKB</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono), monospace", marginBottom: 6 }}>
                  {pct(bucket, total)} of pot
                </div>
                <div style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.1em",
                  color: isAgentCall ? "#00ff85" : isWinner ? "#f0b429" : "rgba(255,255,255,0.6)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}>
                  {label}
                  {isAgentCall && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}> LUCARNE</span>}
                </div>
                {isWinner && (
                  <div style={{ fontSize: 12, color: "#f0b429", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em" }}>
                    WINNER
                  </div>
                )}
                {userAmt > 0n && (
                  <div style={{ fontSize: 11, color: "#f0b429", fontFamily: "var(--font-mono), monospace", marginTop: 6 }}>
                    your stake: {fmt(userAmt)} OKB
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bet / claim UI */}
        {pool.settled ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            {(() => {
              const winnerBucket = [pool.homeBucket, pool.drawBucket, pool.awayBucket][pool.winOutcome];
              const userWinStake = pool.userStakes[pool.winOutcome];
              const payout = winnerBucket > 0n && total > 0n ? (userWinStake * total) / winnerBucket : 0n;
              if (userWinStake > 0n) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 16, color: "#00ff85", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", fontWeight: 700 }}>
                      YOU WON · EST. PAYOUT: {fmt(payout)} OKB
                    </div>
                    <ClaimButton gameId={gameId} wallet={wallet} connectWallet={connectWallet} />
                  </div>
                );
              }
              return (
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono), monospace" }}>
                  Pool settled · Winner: <strong style={{ color: "#f0b429" }}>{OUTCOME_LABELS[pool.winOutcome]}</strong>
                </div>
              );
            })()}
          </div>

        ) : canBet ? (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 14 }}>
              AMOUNT (OKB)
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
              <input
                type="number"
                min="0.001"
                step="0.005"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                style={{
                  width: 130,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#fff",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 16,
                  borderRadius: 4,
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono), monospace" }}>OKB</span>
              {["0.005", "0.01", "0.05", "0.1"].map(v => (
                <button
                  key={v}
                  onClick={() => setBetAmount(v)}
                  style={{
                    padding: "10px 16px",
                    background: betAmount === v ? "rgba(0,255,133,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${betAmount === v ? "#00ff85" : "rgba(255,255,255,0.18)"}`,
                    color: betAmount === v ? "#00ff85" : "rgba(255,255,255,0.55)",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 13,
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
                  padding: "16px 36px",
                  background: "rgba(0,255,133,0.1)",
                  border: "2px solid #00ff85",
                  color: "#00ff85",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 15,
                  letterSpacing: "0.14em",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                CONNECT WALLET TO BET
              </button>
            ) : (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {bucketDefs.map(({ label, outcome }) => {
                  const isSignal = outcome === pool.agentCall;
                  const btnColor = isSignal ? "#00ff85" : outcome === 1 ? "#f0b429" : "#fff";
                  return (
                    <button
                      key={outcome}
                      onClick={() => placeBet(outcome)}
                      disabled={status === "pending"}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: "16px 20px",
                        background: isSignal ? "rgba(0,255,133,0.1)" : "rgba(255,255,255,0.04)",
                        border: `2px solid ${btnColor}`,
                        color: btnColor,
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 14,
                        letterSpacing: "0.1em",
                        fontWeight: 700,
                        cursor: status === "pending" ? "not-allowed" : "pointer",
                        opacity: status === "pending" ? 0.5 : 1,
                        textAlign: "center",
                      }}
                    >
                      BET {label}
                      {isSignal && (
                        <div style={{ fontSize: 10, color: "#00ff85", opacity: 0.7, marginTop: 4, letterSpacing: "0.15em" }}>
                          SAME AS SIGNAL
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        ) : (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono), monospace", textAlign: "center", padding: "16px 0" }}>
            Kickoff passed · Pool awaiting settlement once result is on-chain
          </div>
        )}

        {status === "pending" && (
          <div style={{ marginTop: 18, fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono), monospace" }}>
            Sending transaction...
          </div>
        )}
        {status === "done" && txHash && (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 14, color: "#00ff85", fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>BET PLACED</span>
            <a
              href={`${OKLINK_BASE}/tx/${txHash}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "#00ff85", fontFamily: "var(--font-mono), monospace", textDecoration: "none", border: "1px solid #00ff85", padding: "6px 14px" }}
            >
              VIEW TX
            </a>
          </div>
        )}
        {status === "error" && errMsg && (
          <div style={{ marginTop: 18, fontSize: 13, color: "#e05252", fontFamily: "var(--font-mono), monospace", lineHeight: 1.6 }}>
            {errMsg}
          </div>
        )}
        {wallet && (
          <div style={{ marginTop: 18, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono), monospace" }}>
            {wallet.slice(0, 10)}...{wallet.slice(-6)}{" "}
            {AGENT_WALLET.toLowerCase() === wallet.toLowerCase() ? "· Agent wallet" : "· connected"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Claim button ───────────────────────────────────────────────────────────────

function ClaimButton({ gameId, wallet, connectWallet }: { gameId: `0x${string}`; wallet: string | null; connectWallet: () => void }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });
      const hash = await walletClient.writeContract({
        address: SIGNAL_POOL, abi: CLAIM_ABI, functionName: "claim",
        args: [gameId], account: wallet as `0x${string}`,
      });
      setTxHash(hash);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      const raw = e?.shortMessage ?? e?.message ?? "Claim failed";
      setErrMsg(raw.length > 140 ? raw.slice(0, 140) + "..." : raw);
    }
  }

  if (!wallet) {
    return (
      <button onClick={connectWallet} style={{ padding: "14px 32px", background: "rgba(0,255,133,0.1)", border: "2px solid #00ff85", color: "#00ff85", fontFamily: "var(--font-mono), monospace", fontSize: 15, letterSpacing: "0.14em", cursor: "pointer", fontWeight: 700 }}>
        CONNECT WALLET TO CLAIM
      </button>
    );
  }

  if (status === "done" && txHash) {
    return (
      <a href={`${OKLINK_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
        style={{ fontSize: 14, color: "#00ff85", fontFamily: "var(--font-mono), monospace", textDecoration: "none", border: "1px solid #00ff85", padding: "10px 20px", fontWeight: 700 }}>
        CLAIMED · VIEW TX
      </a>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <button
        onClick={claim}
        disabled={status === "pending"}
        style={{ padding: "16px 40px", background: "rgba(0,255,133,0.12)", border: "2px solid #00ff85", color: "#00ff85", fontFamily: "var(--font-mono), monospace", fontSize: 15, letterSpacing: "0.14em", cursor: status === "pending" ? "not-allowed" : "pointer", fontWeight: 700, opacity: status === "pending" ? 0.6 : 1 }}
      >
        {status === "pending" ? "CLAIMING..." : "CLAIM WINNINGS"}
      </button>
      {status === "error" && errMsg && (
        <div style={{ fontSize: 12, color: "#e05252", fontFamily: "var(--font-mono), monospace" }}>{errMsg}</div>
      )}
    </div>
  );
}
