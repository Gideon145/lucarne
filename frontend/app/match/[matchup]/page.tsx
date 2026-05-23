"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { COUNTRY_MAP } from "@/lib/countries";
import { POLYBOT_URL } from "@/lib/constants";
import BetPanel from "@/components/BetPanel";

interface MatchData {
  teamA: string; nameA: string; oddsA: number | null;
  teamB: string; nameB: string; oddsB: number | null;
  winA: number; draw: number; winB: number;
  brief: string;
}

function ProbBar({
  label, pct, color, align,
}: {
  label: string; pct: number; color: string; align: "left" | "right";
}) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: align === "left" ? "flex-start" : "flex-end",
      gap: 4,
    }}>
      <div style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
        color: "var(--text-dim)",
        letterSpacing: "0.15em",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-orbitron), sans-serif",
        fontSize: 28,
        fontWeight: 800,
        color,
        lineHeight: 1,
      }}>
        {pct}%
      </div>
      <div style={{
        width: "100%",
        height: 6,
        background: "var(--surface-2, rgba(255,255,255,0.06))",
        borderRadius: 3,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          borderRadius: 3,
          float: align === "right" ? "right" : "left",
          transition: "width 0.8s ease",
        }} />
      </div>
    </div>
  );
}

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchup = (params?.matchup as string) ?? "";
  // Slug format: {comp}-{home}-{away}-{year}-{month}-{day}  (6 parts)
  // or shorter:  {home}-{away}-{year}-{month}-{day}         (5 parts)
  const _parts = matchup.toUpperCase().split("-");
  const team1 = _parts.length >= 6 ? (_parts[1] ?? "") : (_parts[0] ?? "");
  const team2 = _parts.length >= 6 ? (_parts[2] ?? "") : (_parts[1] ?? "");

  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const countryA = COUNTRY_MAP.get(team1);
  const countryB = COUNTRY_MAP.get(team2);

  useEffect(() => {
    if (!team1 || !team2) return;
    setLoading(true);
    setError(null);
    fetch(`${POLYBOT_URL}/match/${team1}/${team2}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [team1, team2]);

  const scanColor = data
    ? data.winA > data.winB
      ? "var(--green)"
      : data.winB > data.winA
      ? "var(--amber)"
      : "var(--text-dim)"
    : "var(--green)";

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-mono), monospace",
      padding: "0 16px 60px",
    }}>
      {/* HUD scan line */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${scanColor}, transparent)`,
        opacity: 0.7,
      }} />

      {/* Top nav */}
      <div style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "18px 0 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            cursor: "pointer",
            padding: "5px 12px",
            fontSize: 11,
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.12em",
            borderRadius: 3,
          }}
        >
          ← BACK
        </button>
        <span style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
          color: "var(--text-faint)",
          letterSpacing: "0.2em",
        }}>
          LUCARNE · MATCH INTELLIGENCE
        </span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Teams header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 32,
          padding: "28px 24px",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 10,
        }}>
          {/* Team A */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
            {countryA ? (
              <img
                src={`https://flagcdn.com/w160/${countryA.iso2}.png`}
                alt={countryA.name}
                width={88}
                height={58}
                className="flag-img"
                style={{ objectFit: "cover", borderRadius: 4 }}
              />
            ) : (
              <div style={{ width: 88, height: 58, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} />
            )}
            <div>
              <div style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "0.06em",
              }}>
                {countryA?.name.toUpperCase() ?? team1}
              </div>
              {data?.oddsA != null && (
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
                  WC ODDS · <span style={{ color: "var(--green)" }}>{data.oddsA}%</span>
                </div>
              )}
            </div>
          </div>

          {/* VS divider */}
          <div style={{
            fontFamily: "var(--font-orbitron), sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-faint)",
            letterSpacing: "0.2em",
            padding: "0 12px",
          }}>
            VS
          </div>

          {/* Team B */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {countryB ? (
              <img
                src={`https://flagcdn.com/w160/${countryB.iso2}.png`}
                alt={countryB.name}
                width={88}
                height={58}
                className="flag-img"
                style={{ objectFit: "cover", borderRadius: 4 }}
              />
            ) : (
              <div style={{ width: 88, height: 58, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} />
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "0.06em",
              }}>
                {countryB?.name.toUpperCase() ?? team2}
              </div>
              {data?.oddsB != null && (
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
                  WC ODDS · <span style={{ color: "var(--amber)" }}>{data.oddsB}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{
              fontSize: 12,
              color: "var(--green)",
              letterSpacing: "0.2em",
              animation: "pulse 1.5s ease-in-out infinite",
            }}>
              COMPUTING MATCH ODDS…
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)" }}>
              Querying Polymarket · Generating AI brief
            </div>
          </div>
        )}

        {error && !loading && !error.includes("404") && (
          <div style={{
            padding: 16,
            background: "rgba(255,80,80,0.06)",
            border: "1px solid rgba(255,80,80,0.2)",
            borderRadius: 6,
            color: "rgba(255,100,100,0.8)",
            fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Win/Draw/Loss bars */}
            <div style={{
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: 20,
            }}>
              <div style={{
                fontSize: 10,
                color: "var(--text-faint)",
                letterSpacing: "0.2em",
                marginBottom: 20,
                textAlign: "center",
              }}>
                MATCH OUTCOME PROBABILITY MODEL
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <ProbBar label="WIN" pct={data.winA} color="var(--green)" align="left" />

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  paddingTop: 18,
                  minWidth: 70,
                }}>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.12em" }}>DRAW</div>
                  <div style={{
                    fontFamily: "var(--font-orbitron), sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                  }}>
                    {data.draw}%
                  </div>
                </div>

                <ProbBar label="WIN" pct={data.winB} color="var(--amber)" align="right" />
              </div>
            </div>

            {/* AI Brief */}
            <div style={{
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: 20,
            }}>
              <div style={{
                fontSize: 11,
                color: "var(--green)",
                letterSpacing: "0.18em",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--green)",
                  boxShadow: "0 0 6px var(--green)",
                }} />
                LUCARNE MATCH INTELLIGENCE
              </div>
              <div style={{
                fontSize: 14,
                lineHeight: 1.75,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
              }}>
                {data.brief}
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{
              fontSize: 9,
              color: "var(--text-faint)",
              textAlign: "center",
              letterSpacing: "0.12em",
            }}>
              PROBABILITIES DERIVED FROM POLYMARKET TOURNAMENT WINNER ODDS · NOT FINANCIAL ADVICE
            </div>
          </>
        )}

        {/* Betting pool — always mounted so users can stake before/after odds load */}
        <BetPanel slug={matchup} home={team1} away={team2} />

      </div>
    </main>
  );
}
