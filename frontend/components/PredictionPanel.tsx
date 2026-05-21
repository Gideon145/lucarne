"use client";

import { useEffect, useState, useCallback } from "react";
import { createWalletClient, createPublicClient, custom, http, keccak256, toBytes } from "viem";
import { PREDICTIONS_CONTRACT, OKLINK_BASE } from "@/lib/constants";

// ── ABI (minimal) ─────────────────────────────────────────────────────────────

const ABI = [
  {
    name: "submitPrediction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId",  type: "bytes32" },
      { name: "outcome", type: "uint8"   },
    ],
    outputs: [],
  },
] as const;

// ── Chain def ─────────────────────────────────────────────────────────────────

const xlayer = {
  id:   196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Counts { home: number; draw: number; away: number; total: number; mine: { predicted: boolean; outcome: number } | null }

const OUTCOME_LABELS = ["HOME", "DRAW", "AWAY"] as const;
const OUTCOME_COLORS = ["var(--text-primary)", "var(--amber)", "var(--green)"] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PredictionPanel({
  slug, home, away, isResolved,
}: {
  slug: string; home: string; away: string; isResolved: boolean;
}) {
  const [counts,  setCounts]  = useState<Counts | null>(null);
  const [wallet,  setWallet]  = useState<string | null>(null);
  const [status,  setStatus]  = useState<"idle" | "pending" | "submitted" | "error">("idle");
  const [txHash,  setTxHash]  = useState<string | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  const gameId = keccak256(toBytes(slug)) as `0x${string}`;

  // ── Fetch counts ────────────────────────────────────────────────────────────

  const fetchCounts = useCallback(async (w?: string) => {
    const qs = w ? `?slug=${slug}&wallet=${w}` : `?slug=${slug}`;
    try {
      const res = await fetch(`/api/predictions${qs}`);
      if (res.ok) setCounts(await res.json());
    } catch { /* non-blocking */ }
  }, [slug]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // ── Track account switches in the wallet extension ─────────────────────────
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onAccountsChanged = (accounts: string[]) => {
      const newAddr = accounts[0] ?? null;
      setWallet(newAddr);
      setStatus("idle");
      setErrMsg(null);
      setTxHash(null);
      fetchCounts(newAddr ?? undefined);
    };
    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener("accountsChanged", onAccountsChanged);
  }, [fetchCounts]);

  // ── Connect wallet ──────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) { setErrMsg("No wallet found. Install MetaMask or OKX Wallet."); return null; }

    try {
      // Force the account picker so the user explicitly selects which wallet
      // to predict from. This avoids returning a stale cached connection when
      // multiple accounts exist in the extension.
      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts = await eth.request({ method: "eth_accounts" }) as string[];
      const addr = accounts[0];
      if (!addr) return null;
      setWallet(addr);
      fetchCounts(addr);

      // Switch to X Layer if needed
      const chainHex = `0x${(196).toString(16)}`;
      const currentChain = await eth.request({ method: "eth_chainId" });
      if (currentChain !== chainHex) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
        } catch {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: chainHex,
              chainName: "X Layer Mainnet",
              nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
              rpcUrls: ["https://rpc.xlayer.tech"],
              blockExplorerUrls: ["https://www.oklink.com/xlayer"],
            }],
          });
        }
      }
      return addr;
    } catch { return null; }
  }, [fetchCounts]);

  // ── Submit prediction ───────────────────────────────────────────────────────

  const submit = async (outcome: 0 | 1 | 2) => {
    setErrMsg(null);
    // Always connect to get the currently active account — never use cached wallet.
    // This ensures switching accounts in the extension is picked up correctly.
    const addr = await connect();
    if (!addr) return;

    // Check on-chain whether this wallet has already predicted before sending the tx.
    try {
      const res = await fetch(`/api/predictions?slug=${slug}&wallet=${addr}`);
      if (res.ok) {
        const fresh = await res.json();
        setCounts(fresh);
        if (fresh.mine?.predicted) {
          setErrMsg(`${addr.slice(0, 6)}…${addr.slice(-4)} has already predicted for this game.`);
          return;
        }
      }
    } catch { /* non-blocking — proceed if the check fails */ }

    setStatus("pending");
    try {
      const eth = (window as any).ethereum;
      const walletClient = createWalletClient({ chain: xlayer, transport: custom(eth) });
      const hash = await walletClient.writeContract({
        address: PREDICTIONS_CONTRACT,
        abi: ABI,
        functionName: "submitPrediction",
        args: [gameId, outcome],
        account: addr as `0x${string}`,
      });
      setTxHash(hash);
      setStatus("submitted");
      setTimeout(() => fetchCounts(addr!), 4000); // re-fetch after a few seconds
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.shortMessage ?? e?.message ?? "Transaction failed");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const labels = [home.toUpperCase(), "DRAW", away.toUpperCase()];
  const total  = counts ? Math.max(counts.home + counts.draw + counts.away, 1) : 1;
  const bars   = counts ? [counts.home, counts.draw, counts.away] : [0, 0, 0];
  const alreadyPredicted = counts?.mine?.predicted ?? false;
  const myOutcome = counts?.mine?.outcome ?? null;

  return (
    <div style={{ border: "1px solid var(--border)", marginBottom: 40, background: "rgba(6,15,9,0.4)" }}>

      {/* Header */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 14, letterSpacing: "0.2em", color: "var(--amber)" }}>
          COMMUNITY PREDICTIONS · ON-CHAIN
        </div>
        {counts && (
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 16, color: "#ffffff" }}>
            {counts.home + counts.draw + counts.away} predictions submitted
          </div>
        )}
      </div>

      <div style={{ padding: "24px" }}>

        {/* Bars */}
        {counts && (counts.home + counts.draw + counts.away) > 0 && (
          <div style={{ marginBottom: 24, display: "flex", gap: 12, flexDirection: "column" }}>
            {bars.map((count, i) => {
              const pct = Math.round((count / total) * 100);
              const isMyPick = alreadyPredicted && myOutcome === i;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: isMyPick ? OUTCOME_COLORS[i] : "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em" }}>
                      {labels[i]} {isMyPick ? "← your pick" : ""}
                    </span>
                    <span style={{ fontSize: 16, color: "#ffffff", fontFamily: "var(--font-mono), monospace" }}>{pct}% · {count}</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${pct}%`, background: OUTCOME_COLORS[i], borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action area */}
        {isResolved ? (
          <div style={{ fontSize: 15, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textAlign: "center", padding: "12px 0" }}>
            Market resolved — predictions closed
          </div>
        ) : alreadyPredicted ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 15, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>
              ✓ PREDICTION SUBMITTED ON-CHAIN
            </div>
            {txHash && (
              <a href={`${OKLINK_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}>
                view tx ↗
              </a>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 16, textAlign: "center" }}>
              {status === "pending" ? "CONFIRM IN WALLET…" : "SUBMIT YOUR PREDICTION · FREE · ONE TX"}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {([0, 1, 2] as const).map((i) => (
                <button key={i}
                  disabled={status === "pending"}
                  onClick={() => submit(i)}
                  style={{
                    flex: 1, padding: "14px 8px",
                    background: "transparent",
                    border: `1px solid ${OUTCOME_COLORS[i]}`,
                    color: OUTCOME_COLORS[i],
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 15, letterSpacing: "0.12em",
                    cursor: status === "pending" ? "not-allowed" : "pointer",
                    opacity: status === "pending" ? 0.5 : 1,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (status !== "pending") (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  {labels[i]}
                </button>
              ))}
            </div>
          </>
        )}

        {errMsg && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#ff4444", fontFamily: "var(--font-mono), monospace", textAlign: "center" }}>
            {errMsg}
          </div>
        )}

        {!wallet && !alreadyPredicted && !isResolved && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textAlign: "center" }}>
            Requires MetaMask or OKX Wallet · X Layer Mainnet
          </div>
        )}
      </div>
    </div>
  );
}
