"use client";

import { useEffect, useState, useCallback } from "react";

// Giveaway ends May 26 2026 00:00 UTC (48 hours from launch)
const GIVEAWAY_END = new Date("2026-05-26T00:00:00Z").getTime();

const NATIONS: { iso3: string; iso2: string; name: string }[] = [
  { iso3: "ARG", iso2: "ar",     name: "Argentina"    },
  { iso3: "BRA", iso2: "br",     name: "Brazil"       },
  { iso3: "FRA", iso2: "fr",     name: "France"       },
  { iso3: "ENG", iso2: "gb-eng", name: "England"      },
  { iso3: "ESP", iso2: "es",     name: "Spain"        },
  { iso3: "GER", iso2: "de",     name: "Germany"      },
  { iso3: "POR", iso2: "pt",     name: "Portugal"     },
  { iso3: "NED", iso2: "nl",     name: "Netherlands"  },
  { iso3: "ITA", iso2: "it",     name: "Italy"        },
  { iso3: "URU", iso2: "uy",     name: "Uruguay"      },
  { iso3: "COL", iso2: "co",     name: "Colombia"     },
  { iso3: "MEX", iso2: "mx",     name: "Mexico"       },
  { iso3: "USA", iso2: "us",     name: "USA"          },
  { iso3: "JAP", iso2: "jp",     name: "Japan"        },
  { iso3: "KOR", iso2: "kr",     name: "South Korea"  },
  { iso3: "MAR", iso2: "ma",     name: "Morocco"      },
  { iso3: "CAN", iso2: "ca",     name: "Canada"       },
  { iso3: "BEL", iso2: "be",     name: "Belgium"      },
  { iso3: "CRO", iso2: "hr",     name: "Croatia"      },
  { iso3: "SEN", iso2: "sn",     name: "Senegal"      },
  { iso3: "NGA", iso2: "ng",     name: "Nigeria"      },
  { iso3: "ECU", iso2: "ec",     name: "Ecuador"      },
  { iso3: "AUS", iso2: "au",     name: "Australia"    },
  { iso3: "TUR", iso2: "tr",     name: "Turkey"       },
  { iso3: "CHE", iso2: "ch",     name: "Switzerland"  },
  { iso3: "EGY", iso2: "eg",     name: "Egypt"        },
  { iso3: "IRN", iso2: "ir",     name: "Iran"         },
  { iso3: "SAU", iso2: "sa",     name: "Saudi Arabia" },
  { iso3: "DEN", iso2: "dk",     name: "Denmark"      },
  { iso3: "SRB", iso2: "rs",     name: "Serbia"       },
  { iso3: "VEN", iso2: "ve",     name: "Venezuela"    },
  { iso3: "CMR", iso2: "cm",     name: "Cameroon"     },
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function useCountdown(target: number) {
  const [diff, setDiff] = useState(Math.max(0, target - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { d, h, m, s, over: diff === 0 };
}

export default function CommunityFavourite() {
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<{ iso3: string; iso2: string; name: string } | null>(null);
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(null); // iso3 user voted for
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  const countdown = useCountdown(GIVEAWAY_END);

  const fetchTallies = useCallback(async () => {
    try {
      const res = await fetch("/api/fan-vote");
      const data = await res.json();
      if (data.tallies) {
        setTallies(data.tallies);
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
    if (stored) setVoted(stored);
  }, [fetchTallies]);

  const topCount = Math.max(1, ...Object.values(tallies));

  const sorted = [...NATIONS].sort((a, b) => (tallies[b.iso3] ?? 0) - (tallies[a.iso3] ?? 0));

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
        setAlreadyVoted(true);
        setModal(null);
        return;
      }
      if (!res.ok) {
        setSubmitErr(data.error ?? "Something went wrong");
        return;
      }
      localStorage.setItem("lucarne_fan_vote", modal.iso3);
      setVoted(modal.iso3);
      if (data.tallies) { setTallies(data.tallies); setTotal(data.total); }
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

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: "1px solid rgba(0,255,133,0.15)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,15,9,0.95)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap", gap: 10 }}>
        <a href="/" style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 24, fontWeight: 900, color: "var(--green, #00FF85)", textDecoration: "none", letterSpacing: "0.15em", textShadow: "0 0 18px rgba(0,255,133,0.4)" }}>LUCARNE</a>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/" style={navBtn(false)}>LIVE</a>
          <a href="/survivor" style={navBtn(false)}>HOT SEAT POOL</a>
          <a href="/leaderboard" style={navBtn(false)}>LEADERBOARD</a>
          <a href="/community" style={navBtn(true)}>COMMUNITY FAVOURITE</a>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* ── Intro ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: 11, color: "rgba(0,255,133,0.7)", letterSpacing: "0.2em", marginBottom: 6 }}>⬢ COMMUNITY FAVOURITE — FIFA WORLD CUP 2026</div>
          <h1 style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: "2.2rem", margin: "0 0 0.75rem", color: "rgba(255,255,255,0.95)", lineHeight: 1.1 }}>
            WHO DO YOU BACK?
          </h1>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,0.5)", maxWidth: 640 }}>
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>LUCARNE</strong> is a real-time on-chain AI signal terminal for World Cup 2026 — scoring all 32 nations every 60 seconds on{" "}
            <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>X Layer</a>.
            Pick your favourite nation below to enter the <strong style={{ color: "rgba(0,255,133,0.9)" }}>0.2 OKB giveaway</strong> — one random fan wins when the timer runs out.
            Explore{" "}
            <a href="/survivor" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>Hot Seat Pool</a>,{" "}
            <a href="/leaderboard" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>Leaderboard</a>, or{" "}
            <a href="/" style={{ color: "rgba(0,255,133,0.8)", textDecoration: "none" }}>Live Dashboard</a>.
          </p>
        </div>

        {/* ── Giveaway Banner ────────────────────────────────────────────── */}
        <div style={{ background: "rgba(0,255,133,0.06)", border: "1px solid rgba(0,255,133,0.2)", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(0,255,133,0.7)", letterSpacing: "0.18em", marginBottom: 4 }}>0.2 OKB GIVEAWAY</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              Pick any country → enter your X handle → you&apos;re in the draw.
              {voted && (
                <span style={{ color: "rgba(0,255,133,0.9)", marginLeft: 8 }}>
                  ✓ You backed <strong>{nation(voted)?.name}</strong>
                </span>
              )}
              {alreadyVoted && (
                <span style={{ color: "rgba(255,200,0,0.9)", marginLeft: 8 }}>
                  Handle already entered — only one entry per person.
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {countdown.over ? (
              <span style={{ fontFamily: "var(--font-orbitron, sans-serif)", color: "rgba(0,255,133,0.9)", fontSize: 13, fontWeight: 700 }}>DRAW CLOSED</span>
            ) : (
              <>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", marginBottom: 3 }}>GIVEAWAY ENDS IN</div>
                <div style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 15, fontWeight: 900, color: "rgba(0,255,133,0.95)", textShadow: "0 0 10px rgba(0,255,133,0.35)" }}>
                  {countdown.d}d {pad(countdown.h)}h {pad(countdown.m)}m {pad(countdown.s)}s
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Total Count ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-orbitron, sans-serif)", fontSize: 36, fontWeight: 900, color: "rgba(0,255,133,0.95)", textShadow: "0 0 20px rgba(0,255,133,0.3)" }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>FANS HAVE PICKED THEIR COUNTRY</span>
        </div>

        {/* ── Flag Grid ───────────────────────────────────────────────────── */}
        {!voted && !countdown.over && (
          <>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", marginBottom: "0.75rem" }}>CLICK TO PICK YOUR COUNTRY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: "2.5rem" }}>
              {NATIONS.map(n => (
                <button
                  key={n.iso3}
                  onClick={() => { setModal(n); setHandle(""); setSubmitErr(null); }}
                  style={flagBtn}
                >
                  <img src={`https://flagcdn.com/w40/${n.iso2}.png`} alt={n.name} width={28} height={18} style={{ objectFit: "cover", borderRadius: 2, display: "block" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", lineHeight: 1.2 }}>{n.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Standings ───────────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", marginBottom: "0.75rem" }}>
          {loading ? "LOADING STANDINGS…" : "LIVE STANDINGS"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((n, i) => {
            const count = tallies[n.iso3] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const isMe = voted === n.iso3;
            return (
              <div key={n.iso3} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6, background: isMe ? "rgba(0,255,133,0.05)" : "transparent", border: isMe ? "1px solid rgba(0,255,133,0.15)" : "1px solid transparent" }}>
                <span style={{ width: 20, textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{i + 1}</span>
                <img src={`https://flagcdn.com/w40/${n.iso2}.png`} alt={n.name} width={24} height={16} style={{ objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                <span style={{ width: 110, fontSize: 12, color: isMe ? "rgba(0,255,133,0.9)" : "rgba(255,255,255,0.75)", flexShrink: 0 }}>{n.name}</span>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(count / topCount) * 100}%`, height: "100%", background: isMe ? "rgba(0,255,133,0.8)" : "rgba(0,255,133,0.35)", borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
                <span style={{ width: 42, textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{pct.toFixed(1)}%</span>
                <span style={{ width: 28, textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>{count}</span>
              </div>
            );
          })}
        </div>

        <footer style={{ marginTop: "2.5rem", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.8 }}>
          NOT FINANCIAL ADVICE · 18+ · GIVEAWAY WINNER SELECTED RANDOMLY FROM ALL ENTRIES · PRIZE PAID IN OKB ON X LAYER
        </footer>
      </div>

      {/* ── Entry Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{ background: "#060F09", border: "1px solid rgba(0,255,133,0.25)", borderRadius: 10, padding: "1.75rem", width: "100%", maxWidth: 380 }}>
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
                {submitting ? "ENTERING…" : "ENTER DRAW"}
              </button>
              <button
                onClick={() => setModal(null)}
                style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}
              >
                Cancel
              </button>
            </div>

            <div style={{ marginTop: "0.85rem", fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
              One entry per X handle. Winner announced on{" "}
              <a href="https://x.com/lucarne_xyz" target="_blank" rel="noreferrer" style={{ color: "rgba(0,255,133,0.6)", textDecoration: "none" }}>@lucarne_xyz</a>.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const navBtn = (active: boolean): React.CSSProperties => ({
  fontSize: 10,
  color: active ? "rgba(0,255,133,0.95)" : "rgba(255,255,255,0.4)",
  textDecoration: "none",
  border: active ? "1px solid rgba(0,255,133,0.4)" : "1px solid transparent",
  padding: "4px 10px",
  borderRadius: 4,
  letterSpacing: "0.08em",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap" as const,
});

const flagBtn: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "10px 8px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 7,
  cursor: "pointer",
  transition: "border-color 0.15s, background 0.15s",
  fontFamily: "inherit",
};
