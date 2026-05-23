"use client";

/**
 * /leaderboard — Public on-chain leaderboard of wallets ranked by number of
 * soulbound "I Called It" NFTs minted. Read-only, no wallet required.
 *
 * Pulls Transfer events from both v1 and v2 ICalledItNFT contracts via
 * eth_getLogs on X Layer Mainnet and aggregates by recipient.
 */

import { useEffect, useState } from "react";

const RPC_URL  = "https://rpc.xlayer.tech";
const EXPLORER = "https://www.oklink.com/xlayer";
const NFT_V1   = "0xBB15f43a032c3DE6aB33fDFBfb140FA461854c1E";
const NFT_V2   = "0xBC2200d99980661fef938eE72001BAaE496F0adf";
// ownerOf(uint256) selector
const OWNER_OF_SIG = "0x6352211e";
// Max token IDs to probe per contract
const MAX_TOKENS = 50;

type Holder = { addr: string; count: number };

async function ownerOf(nftAddr: string, tokenId: number): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: tokenId, method: "eth_call",
        params: [
          { to: nftAddr, data: OWNER_OF_SIG + tokenId.toString(16).padStart(64, "0") },
          "latest",
        ],
      }),
    });
    const data = await res.json();
    if (data.error || !data.result || data.result.length !== 66) return null;
    const owner = "0x" + data.result.slice(26).toLowerCase();
    return owner === "0x" + "0".repeat(40) ? null : owner;
  } catch {
    return null;
  }
}

async function fetchMintHolders(): Promise<Holder[]> {
  const tally = new Map<string, number>();
  for (const nftAddr of [NFT_V1, NFT_V2]) {
    const owners = await Promise.all(
      Array.from({ length: MAX_TOKENS }, (_, i) => ownerOf(nftAddr, i + 1))
    );
    for (const owner of owners) {
      if (owner) tally.set(owner, (tally.get(owner) ?? 0) + 1);
    }
  }
  return Array.from(tally.entries())
    .map(([addr, count]) => ({ addr, count }))
    .sort((a, b) => b.count - a.count);
}

function short(a: string) {
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

export default function Leaderboard() {
  const [rows, setRows] = useState<Holder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchMintHolders();
        if (alive) setRows(r);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "fetch failed");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="hud-grid" style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border-glow)", paddingBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
              ⬢ I CALLED IT — LEADERBOARD
            </div>
            <h1 style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: "clamp(1.5rem, 6vw, 2.4rem)", margin: 0, color: "var(--text-primary)" }}>
              ON-CHAIN PROOF RANKING
            </h1>
            <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginTop: "0.4rem" }}>
              Wallets ranked by total soulbound NFTs minted across v1 + v2. Live from X Layer RPC. No backend, no spreadsheet — pure on-chain truth.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <a href="/" style={btn}>← Live Dashboard</a>
            <a href="/judge" style={btn}>JUDGE MODE ↗</a>
          </div>
        </header>

        <section style={card}>
          {err && <div style={{ color: "var(--red)", fontSize: "0.9rem" }}>RPC error: {err}</div>}
          {!rows && !err && <div style={{ color: "var(--text-dim)" }}>Reading Transfer logs…</div>}
          {rows && rows.length === 0 && (
            <div style={{ color: "var(--text-dim)" }}>
              No mints indexed yet. As pools settle and winners mint their proof NFTs, this leaderboard fills in. First two mints already on-chain — refresh after the next mint.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                <thead>
                  <tr style={{ color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={th}>#</th>
                    <th style={th}>Wallet</th>
                    <th style={th}>Calls Proven</th>
                    <th style={th}>OKLink</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.addr} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontFamily: "var(--font-mono), monospace", color: "var(--text-primary)" }}>{short(r.addr)}</td>
                      <td style={{ ...td, color: "var(--gold)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700, fontSize: "1.05rem" }}>{r.count}</td>
                      <td style={td}>
                        <a href={`${EXPLORER}/address/${r.addr}`} target="_blank" rel="noreferrer" style={inlineLink}>view ↗</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ ...card, color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <div style={{ marginBottom: "0.5rem", color: "var(--text-primary)" }}>How this works</div>
          Every soulbound "I Called It" NFT is minted when a bettor proves they backed the winning outcome of a SignalPool. Mints are one-per-wallet-per-game and the NFTs are non-transferable. This page reads <code>Transfer(from=0x0,…)</code> events from both NFT contracts and tallies them by recipient.
        </section>

        <footer style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "0.8rem", padding: "1rem 0", lineHeight: 1.7 }}>
          NOT FINANCIAL ADVICE · 18+ · SELF-CUSTODIAL · AI OUTPUTS MAY BE INACCURATE · DIGITAL ASSETS ARE VOLATILE
        </footer>
      </div>
    </main>
  );
}

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
};

const inlineLink: React.CSSProperties = {
  color: "var(--green)",
  textDecoration: "none",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.85rem",
};
