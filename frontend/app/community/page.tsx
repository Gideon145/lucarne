"use client";

import { useEffect, useState, useCallback } from "react";


const NATIONS: { iso3: string; iso2: string; name: string }[] = [
  // CONMEBOL
  { iso3: "ARG", iso2: "ar",     name: "Argentina"          },
  { iso3: "BRA", iso2: "br",     name: "Brazil"             },
  { iso3: "COL", iso2: "co",     name: "Colombia"           },
  { iso3: "ECU", iso2: "ec",     name: "Ecuador"            },
  { iso3: "PAR", iso2: "py",     name: "Paraguay"           },
  { iso3: "URU", iso2: "uy",     name: "Uruguay"            },
  // UEFA
  { iso3: "AUT", iso2: "at",     name: "Austria"            },
  { iso3: "BEL", iso2: "be",     name: "Belgium"            },
  { iso3: "BIH", iso2: "ba",     name: "Bosnia & Herz."     },
  { iso3: "CRO", iso2: "hr",     name: "Croatia"            },
  { iso3: "CZE", iso2: "cz",     name: "Czech Republic"     },
  { iso3: "ENG", iso2: "gb-eng", name: "England"            },
  { iso3: "FRA", iso2: "fr",     name: "France"             },
  { iso3: "GER", iso2: "de",     name: "Germany"            },
  { iso3: "NED", iso2: "nl",     name: "Netherlands"        },
  { iso3: "NOR", iso2: "no",     name: "Norway"             },
  { iso3: "POR", iso2: "pt",     name: "Portugal"           },
  { iso3: "SCO", iso2: "gb-sct", name: "Scotland"           },
  { iso3: "ESP", iso2: "es",     name: "Spain"              },
  { iso3: "SWE", iso2: "se",     name: "Sweden"             },
  { iso3: "SUI", iso2: "ch",     name: "Switzerland"        },
  { iso3: "TUR", iso2: "tr",     name: "Turkey"             },
  // AFC
  { iso3: "AUS", iso2: "au",     name: "Australia"          },
  { iso3: "IRN", iso2: "ir",     name: "Iran"               },
  { iso3: "IRQ", iso2: "iq",     name: "Iraq"               },
  { iso3: "JPN", iso2: "jp",     name: "Japan"              },
  { iso3: "JOR", iso2: "jo",     name: "Jordan"             },
  { iso3: "QAT", iso2: "qa",     name: "Qatar"              },
  { iso3: "KSA", iso2: "sa",     name: "Saudi Arabia"       },
  { iso3: "KOR", iso2: "kr",     name: "South Korea"        },
  { iso3: "UZB", iso2: "uz",     name: "Uzbekistan"         },
  // CAF
  { iso3: "ALG", iso2: "dz",     name: "Algeria"            },
  { iso3: "CPV", iso2: "cv",     name: "Cape Verde"         },
  { iso3: "COD", iso2: "cd",     name: "DR Congo"           },
  { iso3: "EGY", iso2: "eg",     name: "Egypt"              },
  { iso3: "GHA", iso2: "gh",     name: "Ghana"              },
  { iso3: "CIV", iso2: "ci",     name: "Ivory Coast"        },
  { iso3: "MAR", iso2: "ma",     name: "Morocco"            },
  { iso3: "SEN", iso2: "sn",     name: "Senegal"            },
  { iso3: "RSA", iso2: "za",     name: "South Africa"       },
  { iso3: "TUN", iso2: "tn",     name: "Tunisia"            },
  // CONCACAF
  { iso3: "CAN", iso2: "ca",     name: "Canada"             },
  { iso3: "CUW", iso2: "cw",     name: "Curaçao"            },
  { iso3: "HAI", iso2: "ht",     name: "Haiti"              },
  { iso3: "MEX", iso2: "mx",     name: "Mexico"             },
  { iso3: "PAN", iso2: "pa",     name: "Panama"             },
  { iso3: "USA", iso2: "us",     name: "USA"                },
  // OFC
  { iso3: "NZL", iso2: "nz",     name: "New Zealand"        },
];



export default function CommunityFavourite() {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<{ iso3: string; iso2: string; name: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(null); // iso3 user voted for
  const [thanks, setThanks] = useState<{ iso3: string; iso2: string; name: string } | null>(null);

  const fetchTallies = useCallback(async () => {
    try {
      const res = await fetch("/api/fan-vote");
      const data = await res.json();
      if (data.total !== undefined) {
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTallies();
    // Check localStorage for prior vote
    const stored = localStorage.getItem("lucarne_fan_vote");
    if (stored) {
      setVoted(stored);
      const n = NATIONS.find(x => x.iso3 === stored);
      if (n) setThanks(n);
    }
  }, [fetchTallies]);

  async function submitVote() {
    if (!modal) return;
    const h = handle.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(h)) {
      setSubmitErr("Enter a valid X handle (no spaces, max 15 chars)");
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await fetch("/api/fan-vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ country: modal.iso3, xHandle: h }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSubmitErr("This X handle has already entered.");
        return;
      }
      if (!res.ok) {
        setSubmitErr(data.error ?? "Something went wrong");
        return;
      }
      localStorage.setItem("lucarne_fan_vote", modal.iso3);
      setVoted(modal.iso3);
      if (data.total !== undefined) setTotal(data.total);
      setThanks(modal);
      setModal(null);
    } catch {
      setSubmitErr("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  const nation = (iso3: string) => NATIONS.find(n => n.iso3 === iso3);

  return (
    <main style={{ minHeight: "100vh", background: "var(--void, #030A06)", color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-mono, monospace)" }}>
      <style>{`
        .cm-header { padding: 12px 16px; }
        .cm-logo { font-size: 24px; }
        .cm-nav { display: flex; gap: 8px; flex-wrap: wrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .cm-nav::-webkit-scrollbar { display: none; }
        .cm-container { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem; }
        .cm-h1 { font-size: clamp(1.5rem, 7vw, 2.8rem); margin: 0 0 0.75rem; font-family: var(--font-orbitron, sans-serif); color: rgba(255,255,255,0.95); line-height: 1.1; }
        .cm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(140px, 30vw), 1fr)); gap: 12px; margin-bottom: 2.5rem; }
        .cm-thanks { background: rgba(0,255,133,0.07); border: 1px solid rgba(0,255,133,0.3); border-radius: 10px; padding: 2rem 1.5rem; margin-bottom: 2rem; text-align: center; }
        .cm-thanks-title { font-family: var(--font-orbitron, sans-serif); font-size: clamp(1.2rem, 5vw, 1.6rem); font-weight: 900; color: rgba(0,255,133,0.95); margin-bottom: 8px; }
        .cm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: flex-end; justify-content: center; z-index: 200; padding: 0; }
        .cm-modal-inner { background: #060F09; border: 1px solid rgba(0,255,133,0.25); border-radius: 12px 12px 0 0; padding: 1.5rem; width: 100%; max-width: 480px; }
        @media (min-width: 600px) {
          .cm-modal-overlay { align-items: center; padding: 20px; }
          .cm-modal-inner { border-radius: 10px; max-width: 380px; }
          .cm-header { padding: 14px 24px; }
          .cm-logo { font-size: 24px; }
        }
        @media (max-width: 599px) {
          .cm-container { padding: 1.25rem 0.85rem; }
          .cm-grid { gap: 8px; }
          .cm-thanks { padding: 1.5rem 1rem; }
          .cm-logo { font-size: 20px !important; }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="cm-header" style={{ borderBottom: "1px solid rgba(0,255,133,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,15,9,0.95)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap", gap: 8 }}>
        <a href="/" className="cm-logo" style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontWeight: 900, color: "var(--green, #00FF85)", textDecoration: "none", letterSpacing: "0.15em", textShadow: "0 0 18px rgba(0,255,133,0.4)" }}>LUCARNE</a>
        <div className="cm-nav">
          <a href="/" style={navBtn(false)}>LIVE PREDICTIONS</a>
          <a href="/survivor" style={navBtn(false)}>HOT SEAT POOL</a>
          <a href="/community" style={navBtn(true)}>COMMUNITY FAVOURITE</a>
        </div>
      </header>

      <div className="cm-container">

        {/* ── Intro ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: 11, color: "rgba(0,255,133,0.7)", letterSpacing: "0.2em", marginBottom: 6 }}>⬢ COMMUNITY FAVOURITE — FIFA WORLD CUP 2026</div>
          <h1 className="cm-h1">
            WHO DO YOU BACK?
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: "rgba(255,255,255,0.5)", maxWidth: 640 }}>
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>LUCARNE</strong> is a real-time on-chain AI signal terminal for World Cup 2026 — scoring all 48 nations every 60 seconds on{" "}
            <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>X Layer</a>.
            Pick your favourite nation and enter your X handle to show your support.
            Explore{" "}
            <a href="/survivor" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>Hot Seat Pool</a>{" "}or{" "}
            <a href="/" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>Live Predictions</a>.
          </p>
        </div>


        {/* ── Thank You ───────────────────────────────────────────────────── */}
        {thanks && (
          <div className="cm-thanks">
            <img src={`https://flagcdn.com/w80/${thanks.iso2}.png`} alt={thanks.name} width={72} height={48} style={{ objectFit: "cover", borderRadius: 4, display: "block", margin: "0 auto 1rem" }} />
            <div className="cm-thanks-title">THANK YOU FOR YOUR ENTRY!</div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
              You&apos;re backing <strong style={{ color: "rgba(255,255,255,0.9)" }}>{thanks.name}</strong> for WC 2026.<br />
              Follow <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>@lucarne_xyz</a>{" "}
              for live signals.
            </div>
          </div>
        )}

        {/* ── Flag Grid ───────────────────────────────────────────────────── */}
        {!voted && (
          <>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", marginBottom: "0.75rem" }}>CLICK TO PICK YOUR COUNTRY</div>
            <div className="cm-grid">
              {NATIONS.map(n => (
                <button
                  key={n.iso3}
                  onClick={() => { setModal(n); setHandle(""); setSubmitErr(null); }}
                  style={flagBtn}
                >
                  <img src={`https://flagcdn.com/w40/${n.iso2}.png`} alt={n.name} width={28} height={18} style={{ objectFit: "cover", borderRadius: 2, display: "block" }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", letterSpacing: "0.04em", lineHeight: 1.2 }}>{n.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <footer style={{ marginTop: "2.5rem", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.8 }}>
          NOT FINANCIAL ADVICE · LUCARNE ON-CHAIN TERMINAL FOR FIFA WORLD CUP 2026
        </footer>
      </div>

      {/* ── Entry Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="cm-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="cm-modal-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
              <img src={`https://flagcdn.com/w40/${modal.iso2}.png`} alt={modal.name} width={36} height={24} style={{ objectFit: "cover", borderRadius: 3 }} />
              <div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontWeight: 700, fontSize: 14, color: "rgba(0,255,133,0.95)" }}>{modal.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Your pick for World Cup 2026</div>
              </div>
            </div>

            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", marginBottom: 6 }}>YOUR X HANDLE</label>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "0 10px", marginBottom: "1rem" }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>@</span>
              <input
                autoFocus
                type="text"
                placeholder="yourhandle"
                value={handle}
                onChange={e => { setHandle(e.target.value); setSubmitErr(null); }}
                onKeyDown={e => e.key === "Enter" && submitVote()}
                maxLength={15}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "10px 6px", color: "rgba(255,255,255,0.9)", fontSize: 14, fontFamily: "inherit" }}
              />
            </div>

            {submitErr && <div style={{ fontSize: 12, color: "#ff6b6b", marginBottom: "0.75rem" }}>{submitErr}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={submitVote}
                disabled={submitting || !handle.trim()}
                style={{ flex: 1, padding: "10px 0", background: submitting || !handle.trim() ? "rgba(0,255,133,0.15)" : "rgba(0,255,133,0.2)", border: "1px solid rgba(0,255,133,0.4)", borderRadius: 6, color: submitting || !handle.trim() ? "rgba(0,255,133,0.4)" : "rgba(0,255,133,0.95)", fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 11, fontWeight: 700, cursor: submitting || !handle.trim() ? "not-allowed" : "pointer", letterSpacing: "0.1em" }}
              >
                {submitting ? "SUBMITTING…" : "PICK THIS COUNTRY"}
              </button>
              <button
                onClick={() => setModal(null)}
                style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}
              >
                Cancel
              </button>
            </div>

            <div style={{ marginTop: "0.85rem", fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
              One entry per X handle. Follow{" "}
              <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={{ color: "rgba(0,255,133,0.6)", textDecoration: "none" }}>@lucarne_xyz</a>{" "}
              for live WC 2026 signals.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const navBtn = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  color: active ? "rgba(0,255,133,0.95)" : "rgba(255,255,255,0.4)",
  textDecoration: "none",
  border: active ? "1px solid rgba(0,255,133,0.4)" : "1px solid transparent",
  padding: "5px 12px",
  borderRadius: 4,
  letterSpacing: "0.08em",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap" as const,
});

const flagBtn: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "12px 10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  cursor: "pointer",
  transition: "border-color 0.15s, background 0.15s",
  fontFamily: "inherit",
};
