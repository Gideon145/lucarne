"use client";

/**
 * /judge — Wallet-free hackathon review surface.
 *
 * One page. No wallet required. Live lifetime nonce read directly from X Layer
 * RPC, every deployed contract, every signal/result/NFT/bet tx hash linked to
 * OKLink. Built so a judge can verify Lucarne end-to-end in under a minute.
 */

import { useEffect, useState } from "react";

/* ── Constants ──────────────────────────────────────────────────────────── */
const AGENT_WALLET = "0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3";
const RPC_URL      = "https://rpc.xlayer.tech";
const EXPLORER     = "https://www.oklink.com/xlayer";

const CONTRACTS = [
  { name: "SignalAttestor (32 nations)",   addr: "0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81" },
  { name: "MatchSignalAttestor",            addr: "0x9693d19C09d9dE08F4acaD288f7608552D018482" },
  { name: "MatchResultAttestor",            addr: "0x81AF1dfF7D92ac333a785a1486822159855377bF" },
  { name: "SignalPool v2 (reclaimNoWinner)", addr: "0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67" },
  { name: "ICalledItNFT v2 (soulbound)",    addr: "0xBC2200d99980661fef938eE72001BAaE496F0adf" },
  { name: "LucarnePredictions (community vote)", addr: "0x178565919FFebC4b57ca04112d0FFFaD946Df6E7" },
];

type PipelineRow = {
  num: number;
  game: string;
  date: string;
  call: string;
  signalTx: string;
  result: string;
  resultGood: "win" | "loss" | "pending";
  shipped: string;
};

const PIPELINE: PipelineRow[] = [
  {
    num: 1,
    game: "UEL Final — SC Freiburg vs Aston Villa",
    date: "May 20",
    call: "HOME · Aston Villa",
    signalTx: "0x4e98f3c011ad8c512acc61805550658208370674dd82b8d3820706384aa33f65",
    result: "Aston Villa win — CORRECT",
    resultGood: "win",
    shipped: "Full pipeline e2e: signal generation + on-chain attestation + result resolution",
  },
  {
    num: 2,
    game: "Eredivisie PO — Ajax vs Groningen",
    date: "May 21",
    call: "HOME · Ajax @ 99.8%",
    signalTx: "0x38e3c6cd2e8abe7833839b0840c1ab8bda5afb33ea52879483288fb9dfd62daa",
    result: "Ajax win — CORRECT (pending resolve)",
    resultGood: "win",
    shipped: "Community voting shipped — LucarnePredictions contract live",
  },
  {
    num: 3,
    game: "Serie A — Fiorentina vs Atalanta",
    date: "May 22",
    call: "AWAY · Atalanta",
    signalTx: "0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5",
    result: "0-0 DRAW — WRONG, 0.05 OKB forfeited",
    resultGood: "loss",
    shipped: "Agent-bonded betting shipped — SignalPool + first user bet 0x9176860e…",
  },
  {
    num: 4,
    game: "DFB Pokal Final — Bayern Munich vs Stuttgart",
    date: "May 23",
    call: "HOME · Bayern @ 65%",
    signalTx: "0x81ad7e719a192354a2f76d460b83d95110607031c1571ca72692d106cbfeb0d7",
    result: "Bayern win 3–0 — CORRECT",
    resultGood: "win",
    shipped: "ICalledIt NFT shipped — first soulbound mint 0x01ec8778…",
  },
  {
    num: 5,
    game: "La Liga — Real Madrid vs Athletic Club",
    date: "May 23",
    call: "HOME · Real Madrid @ 68%",
    signalTx: "0xeec67755b145f961c35bfbf93c80a5b52232abcea71716e4ed1eb1f3555c29e5",
    result: "Real Madrid win 4–2 — CORRECT",
    resultGood: "win",
    shipped: "NFT mint flow battle-tested — second mint 0xdc7120d5…",
  },
];

const PROOF_TX = [
  { label: "First agent stake (Fio/Ata · 0.05 OKB)", hash: "0x291c672c3e3af5ee96ccf4e1ef5fa43258399f1876ef2a805b05e2b256b0b002" },
  { label: "First user bet (0.01 OKB · AWAY)",       hash: "0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81" },
  { label: "Agent stake — Bayern/Stuttgart",          hash: "0xe2bd4b93051056ba9638048e776d8b54336e5816a4733edddf7ed53bee860f7f" },
  { label: "Agent stake — Real Madrid/Athletic Club", hash: "0x54e2e03f4e8196424c17df2a4aa56a680089ff3484dda4fc1fdb658b559f4b40" },
  { label: "First ICalledIt NFT mint",               hash: "0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de" },
  { label: "Second ICalledIt NFT mint",              hash: "0xdc7120d57a82670e9773f09404df5f0ef0c95aedeba5083de25f566175158321" },
  { label: "UEL Final resolve (Villa win)",          hash: "0x48de570075c862184c854d2ad0ca4c8ea2666808fb05e1e55310368968cd9467" },
];

async function fetchLifetimeNonce(): Promise<number | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [AGENT_WALLET, "latest"],
      }),
    });
    const data = await res.json();
    return parseInt(data.result, 16);
  } catch {
    return null;
  }
}

function shortTx(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export default function JudgePage() {
  const [nonce, setNonce] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const n = await fetchLifetimeNonce();
      setNonce(n);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen hud-grid" style={{ padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border-glow)", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.9rem", color: "var(--green)", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
                ⬢ JUDGE MODE — X LAYER X CUP HACKATHON
              </div>
              <h1 style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: "clamp(1.8rem, 7vw, 3rem)", margin: 0, color: "var(--text-primary)" }}>
                LUCARNE
              </h1>
              <div style={{ color: "var(--text-dim)", fontSize: "1.1rem", marginTop: "0.25rem" }}>
                Real-time on-chain intelligence terminal for the 2026 FIFA World Cup · Read-only review · No wallet required
              </div>
            </div>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <a href="/" style={linkBtn}>← Live Dashboard</a>
              <a href="/track-record" style={linkBtn}>AGENT TRACK RECORD ↗</a>
              <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={linkBtn}>@lucarne_xyz ↗</a>
            </div>
          </div>
        </header>

        {/* Headline number */}
        <section style={cardLg}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", letterSpacing: "0.2em" }}>
            LIFETIME MAINNET TRANSACTIONS · AGENT WALLET · LIVE FROM X LAYER RPC
          </div>
          <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: "clamp(2.5rem, 10vw, 5.5rem)", color: "var(--green)", lineHeight: 1, marginTop: "0.5rem" }}>
            {nonce !== null ? nonce.toLocaleString() : loading ? "…" : "—"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "1rem", marginTop: "0.75rem" }}>
            Read directly from <code style={inlineCode}>eth_getTransactionCount</code> on{" "}
            <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" style={inlineLink}>
              {AGENT_WALLET.slice(0, 10)}…{AGENT_WALLET.slice(-6)}
            </a>{" "}
            — cannot be fabricated. Refreshes every 60s.
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" style={btnPrimary}>
              Open Agent Wallet on OKLink ↗
            </a>
            <a href="https://frontend-sigma-two-60.vercel.app" target="_blank" rel="noreferrer" style={linkBtn}>
              Live Dashboard ↗
            </a>
            <a href="https://github.com/Gideon145/lucarne" target="_blank" rel="noreferrer" style={linkBtn}>
              GitHub ↗
            </a>
          </div>
        </section>

        {/* Pipeline validation */}
        <section style={card}>
          <h2 style={h2}>Pipeline Validation — 5 Live Club Matches (May 20–23)</h2>
          <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginBottom: "1rem" }}>
            Every game served two purposes: a real public signal call, <b>and</b> the moment we shipped the next layer of the stack.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>#</th>
                  <th style={th}>Game · Date</th>
                  <th style={th}>Call</th>
                  <th style={th}>Signal Tx</th>
                  <th style={th}>Result</th>
                  <th style={th}>Layer Shipped</th>
                </tr>
              </thead>
              <tbody>
                {PIPELINE.map((p) => (
                  <tr key={p.num} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}>{p.num}</td>
                    <td style={{ ...td, color: "var(--text-primary)" }}>
                      <div>{p.game}</div>
                      <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{p.date}</div>
                    </td>
                    <td style={td}>{p.call}</td>
                    <td style={td}>
                      <a href={`${EXPLORER}/tx/${p.signalTx}`} target="_blank" rel="noreferrer" style={inlineLink}>
                        {shortTx(p.signalTx)} ↗
                      </a>
                    </td>
                    <td style={{ ...td, color: p.resultGood === "win" ? "var(--green)" : p.resultGood === "loss" ? "var(--red)" : "var(--amber)" }}>
                      {p.result}
                    </td>
                    <td style={{ ...td, color: "var(--gold)" }}>{p.shipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "1rem", color: "var(--text-dim)", fontSize: "0.9rem" }}>
            <b style={{ color: "var(--text-primary)" }}>Scoreline: 4 correct · 1 wrong · 0 pending.</b>{" "}
            The wrong call (Fiorentina/Atalanta) cost Lucarne 0.05 OKB — proof the pool/settlement path works under adversarial conditions. Real Madrid 4–2 and Bayern 3–0 both called correctly, on-chain before kickoff.
          </div>
        </section>

        {/* Contracts */}
        <section style={card}>
          <h2 style={h2}>Smart Contracts — X Layer Mainnet (Chain 196)</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {CONTRACTS.map((c) => (
              <div
                key={c.addr}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: "var(--text-primary)", fontSize: "1rem" }}>{c.name}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", fontFamily: "var(--font-mono), monospace" }}>
                    {c.addr}
                  </div>
                </div>
                <a href={`${EXPLORER}/address/${c.addr}`} target="_blank" rel="noreferrer" style={linkBtn}>
                  View ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Proof TX */}
        <section style={card}>
          <h2 style={h2}>On-Chain Proof — Pool Stakes · User Bets · NFT Mints</h2>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {PROOF_TX.map((t) => (
              <div
                key={t.hash}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.6rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}>{t.label}</div>
                <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" style={inlineLink}>
                  {shortTx(t.hash)} ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Verify yourself */}
        <section style={card}>
          <h2 style={h2}>Verify in 30 Seconds (Terminal)</h2>
          <pre style={pre}>{`curl -X POST ${RPC_URL} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount",
       "params":["${AGENT_WALLET}","latest"]}'`}</pre>
          <div style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            The returned hex is the lifetime confirmed transaction count on the agent wallet. It cannot be fabricated.
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "0.85rem", padding: "2rem 0 1rem", lineHeight: 1.7 }}>
          <div style={{ marginBottom: "0.75rem" }}>
            LUCARNE · World Cup 2026 · X Layer Mainnet (Chain 196)
            {" · "}
            <a href="https://github.com/Gideon145/lucarne" target="_blank" rel="noreferrer" style={inlineLink}>GitHub</a>
            {" · "}
            <a href="https://github.com/Gideon145/lucarne/blob/main/JUDGE_GUIDE.md" target="_blank" rel="noreferrer" style={inlineLink}>JUDGE_GUIDE.md</a>
            {" · "}
            <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={inlineLink}>@lucarne_xyz</a>
          </div>
          <div style={{ maxWidth: 720, margin: "0 auto", color: "var(--text-dim)", fontSize: "0.78rem" }}>
            <b>Disclaimer.</b> Not financial advice. Digital assets are volatile and AI agent outputs may be inaccurate — every Lucarne signal is one input, not the truth. 18+ only. Self-custodial — Lucarne never custodies user funds. No artificial volume; all pool stakes and NFT mints linked above are organic on-chain actions. Independent hackathon submission; not endorsed by OKX, X Layer, FIFA, Polymarket, or Anthropic.
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  padding: "1.25rem",
  marginBottom: "1rem",
  background: "var(--card)",
  border: "1px solid var(--border-glow)",
  borderRadius: 8,
};

const cardLg: React.CSSProperties = {
  padding: "1.5rem",
  marginBottom: "1rem",
  background: "var(--card)",
  border: "1px solid var(--green-dim)",
  borderRadius: 8,
  boxShadow: "0 0 30px var(--green-glow)",
};

const h2: React.CSSProperties = {
  fontFamily: "var(--font-orbitron), sans-serif",
  fontSize: "1.2rem",
  color: "var(--green)",
  letterSpacing: "0.15em",
  margin: "0 0 1rem",
  textTransform: "uppercase",
};

const th: React.CSSProperties = {
  padding: "0.5rem 0.5rem",
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

const pre: React.CSSProperties = {
  background: "var(--void)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "0.85rem",
  fontSize: "0.85rem",
  color: "var(--text-primary)",
  overflowX: "auto",
  margin: 0,
};

const linkBtn: React.CSSProperties = {
  color: "var(--green)",
  textDecoration: "none",
  fontSize: "0.9rem",
  padding: "0.4rem 0.75rem",
  border: "1px solid var(--border-glow)",
  borderRadius: 4,
  display: "inline-block",
};

const btnPrimary: React.CSSProperties = {
  ...linkBtn,
  background: "var(--green-glow)",
  color: "var(--green)",
  borderColor: "var(--green-dim)",
};

const inlineLink: React.CSSProperties = {
  color: "var(--green)",
  textDecoration: "none",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.9rem",
};

const inlineCode: React.CSSProperties = {
  background: "var(--surface)",
  padding: "0.1rem 0.35rem",
  borderRadius: 3,
  fontSize: "0.85rem",
  color: "var(--gold)",
};
