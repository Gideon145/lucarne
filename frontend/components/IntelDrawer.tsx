"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NationData } from "@/lib/useAttestations";
import { COUNTRY_MAP } from "@/lib/countries";
import { AGENT_WALLET, POLYBOT_URL } from "@/lib/constants";
import { RegimeBadge, REGIME_COLORS, REGIME_LABELS } from "./RegimeBadge";
import type { Regime } from "@/lib/useAttestations";

interface Player {
  name: string;
  position: string;
  club: string;
  why: string;
}

interface Fixture {
  opponent: string;
  opp_name: string;
  date: string;
  home: boolean;
}

interface IntelData {
  country: string;
  name: string;
  score: number;
  regime: number;
  odds: number | null;
  brief: string;
  players: Player[];
  fixtures: Fixture[];
  x402_demo?: boolean;
}

interface Props {
  nation: NationData | null;
  onClose: () => void;
}

const POSITION_LABEL: Record<string, string> = {
  G: "GK", D: "DEF", M: "MID", F: "FWD",
};

function posLabel(pos: string): string {
  return POSITION_LABEL[pos?.[0]?.toUpperCase()] ?? pos ?? "?";
}

export function IntelDrawer({ nation, onClose }: Props) {
  const router = useRouter();
  const [intel, setIntel] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState<{ description: string } | null>(null);
  const [paying, setPaying] = useState(false);

  const country = nation ? COUNTRY_MAP.get(nation.iso3) : null;

  const fetchIntel = useCallback(async (n: NationData, paymentHeader?: string) => {
    setLoading(true);
    setError(null);
    if (!paymentHeader) { setIntel(null); setPaymentRequired(null); }
    try {
      const res = await fetch(
        `${POLYBOT_URL}/intel/${n.iso3}?score=${n.score}&regime=${n.regime}`,
        paymentHeader ? { headers: { "X-Payment": paymentHeader } } : undefined,
      );
      if (res.status === 402) {
        const data = await res.json();
        const desc = data?.x402?.accepts?.[0]?.description ?? "LUCARNE Signal Intel Brief";
        setPaymentRequired({ description: desc });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIntel(data);
      setPaymentRequired(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load intel");
    } finally {
      setLoading(false);
    }
  }, []);

  const payAndUnlock = useCallback(async () => {
    if (!nation) return;
    setPaying(true);
    try {
      const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const validBefore = String(Math.floor(Date.now() / 1000) + 300);
      const token = {
        x402Version: 1,
        scheme: "exact",
        network: "xlayer-mainnet",
        payload: {
          signature: "0x" + "0".repeat(130),
          authorization: {
            from: AGENT_WALLET,
            to: "0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81",
            value: "10000",
            validAfter: "0",
            validBefore,
            nonce,
          },
        },
      };
      const encoded = btoa(JSON.stringify(token));
      await fetchIntel(nation, encoded);
    } finally {
      setPaying(false);
    }
  }, [nation, fetchIntel]);

  useEffect(() => {
    if (nation) fetchIntel(nation);
    else { setIntel(null); setError(null); }
  }, [nation, fetchIntel]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = !!nation;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(3,10,6,0.72)",
          backdropFilter: "blur(4px)",
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.22s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "clamp(320px, 42vw, 560px)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-strong)",
          zIndex: 50,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* HUD scan line top */}
              <div style={{ height: 2, background: nation
          ? `linear-gradient(90deg, transparent, ${REGIME_COLORS[nation.regime as Regime]}, transparent)`
          : "var(--green)", opacity: 0.7 }} />

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}>
          {nation && country ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <img
                src={`https://flagcdn.com/w160/${country.iso2}.png`}
                alt={country.name}
                width={72}
                height={48}
                className="flag-img"
                style={{ objectFit: "cover", borderRadius: 4 }}
              />
              <div>
                <div style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  color: "var(--text-primary)",
                  letterSpacing: "0.06em",
                }}>
                  {country.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.12em", marginTop: 2 }}>
                  {nation.iso3} · {country.confederation} · SIGNAL {nation.score}/100
                </div>
                  {nation && <div style={{ marginTop: 6 }}>
                  <RegimeBadge regime={nation.regime as Regime} />
                </div>}
              </div>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: "4px 10px",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.1em",
              borderRadius: 3,
            }}
          >
            ESC
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", flex: 1 }}>

          {loading && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: "var(--green)",
                letterSpacing: "0.2em",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                {paying ? "PROCESSING PAYMENT…" : "LOADING INTEL…"}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)" }}>
                {paying ? "x402 · X Layer · OKX Onchain OS" : "Querying Polymarket · generating AI brief"}
              </div>
            </div>
          )}

          {/* x402 payment gate */}
          {paymentRequired && !loading && !intel && (
            <div style={{
              marginTop: 40,
              padding: "28px 24px",
              background: "rgba(0,255,133,0.03)",
              border: "1px solid rgba(0,255,133,0.18)",
              borderRadius: 8,
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 11,
                fontFamily: "var(--font-mono), monospace",
                color: "var(--green)",
                letterSpacing: "0.22em",
                marginBottom: 10,
                opacity: 0.7,
              }}>
                ◈ INTEL BRIEF LOCKED
              </div>
              <div style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontSize: 28,
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "0.04em",
                marginBottom: 4,
              }}>
                0.01 USDC
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--text-faint)",
                fontFamily: "var(--font-mono), monospace",
                letterSpacing: "0.14em",
                marginBottom: 4,
              }}>
                X LAYER · OKX ONCHAIN OS · x402
              </div>
              <div style={{
                fontSize: 12,
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: 24,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 4,
                border: "1px solid var(--border)",
              }}>
                {paymentRequired.description}
              </div>
              <button
                onClick={payAndUnlock}
                disabled={paying}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  background: "var(--green)",
                  border: "none",
                  borderRadius: 5,
                  color: "#030a06",
                  fontFamily: "var(--font-orbitron), sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  cursor: paying ? "not-allowed" : "pointer",
                  opacity: paying ? 0.6 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {paying ? "PROCESSING…" : "PAY & UNLOCK BRIEF →"}
              </button>
              <div style={{
                marginTop: 10,
                fontSize: 10,
                color: "var(--text-faint)",
                fontFamily: "var(--font-mono), monospace",
                letterSpacing: "0.1em",
              }}>
                Powered by OKX okx-agent-payments-protocol
              </div>
            </div>
          )}

          {error && !loading && (
            <div style={{
              padding: 16,
              background: "rgba(255,80,80,0.06)",
              border: "1px solid rgba(255,80,80,0.2)",
              borderRadius: 6,
              color: "rgba(255,100,100,0.8)",
              fontSize: 12,
              fontFamily: "var(--font-mono), monospace",
            }}>
              {error}
            </div>
          )}

          {intel && nation && !loading && (
            <>
              {/* Stats bar */}
              {intel.odds !== null && (
                <div style={{
                  display: "flex",
                  gap: 20,
                  marginBottom: 20,
                  padding: "12px 16px",
                  background: "rgba(0,255,133,0.04)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.12em" }}>POLYMARKET ODDS</div>
                    <div style={{
                      fontFamily: "var(--font-orbitron), sans-serif",
                      fontSize: 22,
                      fontWeight: 700,
                      color: REGIME_COLORS[nation!.regime as Regime],
                    }}>
                      {intel.odds}%
                    </div>
                  </div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.12em" }}>LUCARNE SCORE</div>
                    <div style={{
                      fontFamily: "var(--font-orbitron), sans-serif",
                      fontSize: 22,
                      fontWeight: 700,
                      color: REGIME_COLORS[nation!.regime as Regime],
                    }}>
                      {intel.score}<span style={{ fontSize: 12, color: "var(--text-dim)" }}>/100</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.12em" }}>REGIME</div>
                    <div style={{
                      fontFamily: "var(--font-orbitron), sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      color: REGIME_COLORS[intel.regime as Regime],
                      marginTop: 4,
                    }}>
                      {REGIME_LABELS[intel.regime]}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Brief */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 12,
                  color: "var(--green)",
                  letterSpacing: "0.18em",
                  fontFamily: "var(--font-mono), monospace",
                  marginBottom: 10,
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
                  LUCARNE INTEL BRIEF
                  {intel.x402_demo && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 9,
                      fontFamily: "var(--font-mono), monospace",
                      letterSpacing: "0.14em",
                      color: "#ffffff",
                      opacity: 0.55,
                      border: "1px solid rgba(255,255,255,0.25)",
                      borderRadius: 3,
                      padding: "1px 5px",
                    }}>x402 DEMO</span>
                  )}
                </div>
                <div style={{
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono), monospace",
                  whiteSpace: "pre-wrap",
                }}>
                  {intel.brief}
                </div>
              </div>

              {/* Key Players to Watch */}
              {intel.players.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    fontSize: 12,
                    color: "var(--green)",
                    letterSpacing: "0.18em",
                    fontFamily: "var(--font-mono), monospace",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span>⚡</span> KEY PLAYERS TO WATCH
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {intel.players.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 14px",
                          background: "rgba(0,255,133,0.03)",
                          border: "1px solid var(--border)",
                          borderLeft: "2px solid var(--green)",
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono), monospace",
                            background: "rgba(0,255,133,0.1)",
                            color: "var(--green)",
                            padding: "2px 6px",
                            borderRadius: 2,
                            letterSpacing: "0.1em",
                          }}>
                            {p.position || "?"}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                          {p.club && (
                            <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{p.club}</span>
                          )}
                        </div>
                        {p.why && (
                          <div style={{
                            fontSize: 12,
                            color: "var(--text-dim)",
                            fontFamily: "var(--font-mono), monospace",
                            lineHeight: 1.5,
                          }}>
                            {p.why}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WC 2026 Fixtures */}
              {intel.fixtures && intel.fixtures.length > 0 ? (
                <div>
                  <div style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    letterSpacing: "0.18em",
                    fontFamily: "var(--font-mono), monospace",
                    marginBottom: 10,
                  }}>
                    WC 2026 GROUP STAGE
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {intel.fixtures.map((f, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const iso3a = intel.country;
                          const iso3b = COUNTRY_MAP.get(f.opponent)?.iso3 ?? f.opponent;
                          router.push(`/match/${iso3a}-${iso3b}`);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "rgba(255,255,255,0.015)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "rgba(0,255,133,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.015)";
                        }}
                      >
                        <div style={{ fontSize: 14, fontFamily: "var(--font-mono), monospace", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-dim)", fontSize: 11, marginRight: 6 }}>
                            {f.home ? "H" : "A"}
                          </span>
                          {f.home
                            ? <>{intel.name} <span style={{ color: "var(--text-dim)" }}>vs</span> {f.opp_name}</>
                            : <>{intel.name} <span style={{ color: "var(--text-dim)" }}>@</span> {f.opp_name}</>
                          }
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
                            {f.date}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--green)", letterSpacing: "0.1em" }}>
                            ODDS →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                intel.fixtures && intel.fixtures.length === 0 && (
                  <div style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "var(--text-faint)",
                    fontFamily: "var(--font-mono), monospace",
                  }}>
                    No WC 2026 group stage fixtures available
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 24px",
          borderTop: "1px solid var(--border)",
          fontSize: 9,
          color: "var(--text-faint)",
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.12em",
        }}>
          DATA: SOFASCORE · POLYMARKET GAMMA · LUCARNE SIGNAL ATTESTOR (X LAYER)
        </div>
      </div>
    </>
  );
}
