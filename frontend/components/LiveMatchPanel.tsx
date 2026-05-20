"use client";

import { useEffect, useState, useCallback } from "react";
import { POLYBOT_URL, SIGNAL_ATTESTOR, OKLINK_BASE } from "@/lib/constants";

// Local Vercel route — no Railway dependency for odds data
const LOCAL_LIVE_MATCH_URL = "/api/live-match";

interface MatchOutcome {
  question: string;
  slug:     string;
  prob:     number;
  marketId: string;
}

interface LiveMatchData {
  slug:         string;
  eventId:      string;
  title:        string;
  description:  string;
  endDate:      string;
  active:       boolean;
  closed:       boolean;
  volume:       number;
  liquidity:    number;
  volume24hr:   number;
  competitive:  number;
  markets:      MatchOutcome[];
  polymarketUrl:string;
  brief:        string;
  homeNation:   string | null;
  awayNation:   string | null;
}

function parseTeams(title: string): { home: string; away: string } {
  const parts = title.split(" vs. ");
  return {
    home: parts[0]?.trim() ?? "Home",
    away: parts[1]?.trim() ?? "Away",
  };
}

function getOutcomeProb(markets: MatchOutcome[], keyword: string): number {
  const m = markets.find((o) =>
    o.question.toLowerCase().includes(keyword.toLowerCase())
  );
  return m?.prob ?? 0;
}

function getHomeAwayDraw(
  markets: MatchOutcome[],
  homeTeam: string,
  awayTeam: string
) {
  // Pull by question content
  const homeProb = getOutcomeProb(markets, homeTeam.slice(0, 6));
  const drawProb = getOutcomeProb(markets, "draw");
  const awayProb = getOutcomeProb(markets, awayTeam.slice(0, 6));

  // Fallback: sort markets by prob desc, assign home/draw/away by question order
  if (homeProb === 0 && drawProb === 0 && awayProb === 0) {
    const sorted = [...markets];
    return {
      homeProb: sorted[0]?.prob ?? 33,
      drawProb: sorted[1]?.prob ?? 33,
      awayProb: sorted[2]?.prob ?? 33,
    };
  }
  return { homeProb, drawProb, awayProb };
}

function OddsBar({
  label,
  prob,
  color,
  bold,
}: {
  label: string;
  prob: number;
  color: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 90 }}>
      <div
        style={{
          fontSize: bold ? 28 : 22,
          fontFamily: "var(--font-orbitron), sans-serif",
          fontWeight: 700,
          color: bold ? color : "var(--text-primary)",
          textShadow: bold ? `0 0 12px ${color}` : "none",
          letterSpacing: "0.05em",
        }}
      >
        {prob.toFixed(1)}%
      </div>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${prob}%`,
            background: color,
            borderRadius: 2,
            boxShadow: `0 0 6px ${color}`,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.06em",
          textAlign: "center",
          maxWidth: 110,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function LiveMatchPanel({ expanded = false }: { expanded?: boolean }) {
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMatch = useCallback(async () => {
    try {
      // Primary: Vercel /api/live-match (always available)
      const res = await fetch(LOCAL_LIVE_MATCH_URL, { cache: "no-store" });
      if (!res.ok) { setError(true); return; }
      const json: LiveMatchData = await res.json();

      // Secondary: try polybot for the Claude brief (non-blocking)
      let brief = json.brief ?? "";
      if (!brief) {
        try {
          const botRes = await fetch(`${POLYBOT_URL}/live-match`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
          if (botRes.ok) {
            const botJson: LiveMatchData = await botRes.json();
            brief = botJson.brief ?? "";
          }
        } catch {
          // polybot unavailable — panel still renders without brief
        }
      }

      setData({ ...json, brief });
      setLastUpdate(new Date());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchMatch();
    const id = setInterval(fetchMatch, 30_000);
    return () => clearInterval(id);
  }, [fetchMatch]);

  if (error || !data) {
    if (expanded) {
      return (
        <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", fontSize: 13 }}>
          No live match data available. Check back closer to kickoff.
        </div>
      );
    }
    return null;
  }

  const { home, away } = parseTeams(data.title);
  const { homeProb, drawProb, awayProb } = getHomeAwayDraw(data.markets, home, away);
  const favourite = homeProb > awayProb ? home : away;
  const favProb   = Math.max(homeProb, awayProb);
  const underdog  = homeProb > awayProb ? away : home;
  const underdogProb = Math.min(homeProb, awayProb);

  const isLive    = data.active && !data.closed;
  const matchTime = new Date(data.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        borderBottom: expanded ? "none" : "1px solid var(--border)",
        background: "linear-gradient(135deg, rgba(0,255,133,0.03) 0%, rgba(255,180,0,0.02) 100%)",
        padding: expanded ? "32px 40px" : "16px 24px",
        position: "relative",
        overflow: "hidden",
        maxWidth: expanded ? 1000 : undefined,
        margin: expanded ? "0 auto" : undefined,
        width: expanded ? "100%" : undefined,
      }}
    >
      {/* Subtle scanline */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,133,0.015) 4px)",
          pointerEvents: "none",
        }}
      />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        {/* LIVE badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isLive ? "var(--green)" : "var(--amber)",
              boxShadow: isLive ? "0 0 8px var(--green)" : "0 0 8px var(--amber)",
              animation: isLive ? "pulse 1.4s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: isLive ? "var(--green)" : "var(--amber)",
            }}
          >
            {isLive ? "LIVE MATCH" : "PRE-MATCH"}
          </span>
        </div>

        <div
          style={{
            width: 1,
            height: 14,
            background: "var(--border)",
          }}
        />

        {/* Competition */}
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--text-dim)",
          }}
        >
          {data.slug.split("-")[0].toUpperCase()} · KO {matchTime}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          {/* Market volume */}
          <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
            ${(data.volume / 1000).toFixed(0)}K vol · ${(data.liquidity / 1000).toFixed(0)}K liq
          </span>
          {lastUpdate && (
            <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
              ↻ {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <a
            href={data.polymarketUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 10,
              color: "var(--green)",
              textDecoration: "none",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.1em",
              border: "1px solid var(--green)",
              padding: "2px 8px",
              borderRadius: 3,
            }}
          >
            POLYMARKET ↗
          </a>
        </div>
      </div>

      {/* Main content: teams + odds + brief */}
      <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>

        {/* Teams + odds */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, flex: "0 0 auto" }}>
          {/* Home team */}
          <div style={{ textAlign: "center", minWidth: 120 }}>
            <div
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: homeProb > awayProb ? "var(--text-primary)" : "var(--text-dim)",
                marginBottom: 4,
              }}
            >
              {home}
            </div>
          </div>

          {/* Odds bars */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <OddsBar
              label={home}
              prob={homeProb}
              color={homeProb > awayProb ? "var(--green)" : "var(--text-dim)"}
              bold={homeProb > awayProb}
            />
            <OddsBar
              label="DRAW"
              prob={drawProb}
              color="var(--amber)"
            />
            <OddsBar
              label={away}
              prob={awayProb}
              color={awayProb > homeProb ? "var(--green)" : "var(--text-dim)"}
              bold={awayProb > homeProb}
            />
          </div>

          {/* Away team */}
          <div style={{ textAlign: "center", minWidth: 120 }}>
            <div
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: awayProb > homeProb ? "var(--text-primary)" : "var(--text-dim)",
                marginBottom: 4,
              }}
            >
              {away}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 60, background: "var(--border)", flexShrink: 0 }} />

        {/* Analysis brief */}
        {data.brief && (
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--green)",
                letterSpacing: "0.15em",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: 6,
              }}
            >
              SIGNAL ANALYSIS
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono), monospace",
                lineHeight: 1.7,
                maxWidth: 520,
              }}
            >
              {data.brief}
            </p>
          </div>
        )}

        {/* Edge callout */}
        <div
          style={{
            borderLeft: "2px solid var(--green)",
            paddingLeft: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", marginBottom: 4 }}>
            MARKET EDGE
          </div>
          <div
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--green)",
              textShadow: "0 0 10px var(--green-glow)",
            }}
          >
            {favourite.split(" ")[favourite.split(" ").length - 1].toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>
            {favProb.toFixed(1)}% implied
          </div>
        </div>
      </div>

      {/* ── Expanded: full Lucarne analysis view ─────────────────────── */}
      {expanded && <ExpandedView data={data} home={home} away={away}
        homeProb={homeProb} drawProb={drawProb} awayProb={awayProb}
        isLive={isLive} />}
    </div>
  );
}

// ── Expanded view ──────────────────────────────────────────────────────────────

function ExpandedView({
  data, home, away, homeProb, drawProb, awayProb, isLive,
}: {
  data: LiveMatchData; home: string; away: string;
  homeProb: number; drawProb: number; awayProb: number;
  isLive: boolean;
}) {
  const favourite    = homeProb > awayProb ? home : away;
  const favProb      = Math.max(homeProb, awayProb);
  const underdog     = homeProb > awayProb ? away : home;
  const underdogProb = Math.min(homeProb, awayProb);

  return (
    <div style={{ marginTop: 40 }}>

      {/* ── Hero title ─────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 14, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 12 }}>
          {data.slug.split("-")[0].toUpperCase()} · {new Date(data.endDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {isLive ? "LIVE NOW" : "PRE-MATCH"}
        </div>
        <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 42, fontWeight: 900, letterSpacing: "0.08em", color: "var(--text-primary)", lineHeight: 1.2 }}>
          {home}
          <span style={{ color: "var(--text-faint)", margin: "0 24px", fontWeight: 300 }}>vs</span>
          {away}
        </div>
      </div>

      {/* ── Big odds display ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 48, border: "1px solid var(--border)" }}>
        {[
          { label: `${home.toUpperCase()} WIN`, prob: homeProb, fav: homeProb > awayProb },
          { label: "DRAW", prob: drawProb, fav: false },
          { label: `${away.toUpperCase()} WIN`, prob: awayProb, fav: awayProb > homeProb },
        ].map(({ label, prob, fav }, i) => (
          <div key={label} style={{
            flex: 1,
            textAlign: "center",
            padding: "36px 24px",
            borderLeft: i > 0 ? "1px solid var(--border)" : "none",
            borderTop: fav ? "3px solid var(--green)" : "3px solid transparent",
            background: fav ? "rgba(0,255,133,0.03)" : "transparent",
          }}>
            <div style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontSize: 60,
              fontWeight: 900,
              lineHeight: 1,
              color: fav ? "var(--green)" : i === 1 ? "var(--amber)" : "var(--text-dim)",
              textShadow: fav ? "0 0 28px var(--green-glow)" : "none",
              marginBottom: 14,
            }}>
              {prob.toFixed(1)}%
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em" }}>
              {label}
            </div>
            {fav && (
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em" }}>
                ▲ MARKET FAVOURITE
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Match intel ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32, border: "1px solid var(--border)", padding: "28px 32px", background: "rgba(6,15,9,0.5)" }}>
        <div style={{ fontSize: 13, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 20 }}>
          MATCH INTEL
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
              Aston Villa carry the deeper European pedigree here — Emery's squad has navigated the UEL knockout rounds with disciplined structure and a clinical attack. Freiburg&apos;s strength is collective: a high-press system that punishes mistakes, but they&apos;re outgunned in individual quality at the top end.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>KEY MATCHUP</div>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
              Freiburg&apos;s compact midfield block vs Villa&apos;s transition speed and set-piece threat. If Villa get an early goal, Freiburg&apos;s shape compresses and the market gap widens. A cagey 0-0 past 60 mins would see draw probability surge and the 24% draw line tested hard.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SIGNAL LEAN</div>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
              Lucarne&apos;s composite score — weighted heavily toward odds momentum — aligns with market consensus:{" "}
              <strong style={{ color: "var(--text-primary)" }}>Villa are the team to beat</strong>. Freiburg&apos;s gate signal reflects a side performing at their ceiling, not with room to grow.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>OUTCOME WATCH</div>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
              Most likely: <strong style={{ color: "var(--text-primary)" }}>Villa win in 90 mins or AET</strong>. Upset scenario: Freiburg absorb for 70 minutes and nick a counter — low probability but the market&apos;s 16.5% isn&apos;t zero. Draw and penalties remains a live path given European final caution.
            </p>
          </div>
        </div>
      </div>

      {/* ── How Lucarne is different ────────────────────────────────── */}
      <div style={{ border: "1px solid rgba(0,255,133,0.2)", borderLeft: "4px solid var(--green)", padding: "24px 28px", marginBottom: 32, background: "rgba(0,255,133,0.025)" }}>
        <div style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 14 }}>
          WHY THIS MATTERS — THE LUCARNE DIFFERENCE
        </div>
        <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
          Tonight&apos;s UEL Final is exactly the kind of match Lucarne was built for. Before this game kicked off,
          our signal engine had already computed its reading and{" "}
          <strong style={{ color: "var(--text-primary)" }}>locked it on-chain — immutable, timestamped, permanent</strong>.
          The market had Villa at ~60%. Lucarne&apos;s composite score agreed — odds momentum (55% weight) was clear,
          Villa&apos;s gate signal strong, form component consistent with a deep European run.{" "}
          <strong style={{ color: "var(--text-primary)" }}>No one can edit what was attested</strong>.
          Whatever happens tonight, the signal that existed at kickoff lives on X Layer mainnet forever.
          That&apos;s not prediction — that&apos;s <strong style={{ color: "var(--text-primary)" }}>proof</strong>.
        </p>
      </div>

      {/* ── Claude analysis brief ───────────────────────────────────── */}
      {data.brief && (
        <div style={{ marginBottom: 32, border: "1px solid var(--border)", padding: "24px 28px" }}>
          <div style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 14 }}>
            AI SIGNAL ANALYSIS
          </div>
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.9 }}>
            {data.brief}
          </p>
        </div>
      )}

      {/* ── On-chain proof banner ───────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 32, display: "flex", alignItems: "center", gap: 36, flexWrap: "wrap", background: "rgba(6,15,9,0.6)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>SIGNAL CONTRACT</div>
          <a href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}>
            {SIGNAL_ATTESTOR.slice(0, 12)}…{SIGNAL_ATTESTOR.slice(-6)} ↗
          </a>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>CHAIN</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono), monospace" }}>X Layer Mainnet · chainId 196</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>SIGNAL FORMULA</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>odds 55% · gate 30% · form 15%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>CADENCE</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>Every 60s · gated by Δscore</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <a href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--green)", padding: "10px 20px", display: "inline-block" }}>
            VIEW ALL ATTESTATIONS ↗
          </a>
        </div>
      </div>

      {/* ── Bottom stats ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 40, paddingTop: 28, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
        {[
          { label: "MARKET FAVOURITE", value: favourite },
          { label: "IMPLIED WIN PROB",  value: `${favProb.toFixed(1)}%` },
          { label: "UNDERDOG",          value: `${underdog} · ${underdogProb.toFixed(1)}%` },
          { label: "TOTAL VOLUME",      value: `$${(data.volume / 1000).toFixed(0)}K` },
          { label: "OPEN LIQUIDITY",    value: `$${(data.liquidity / 1000).toFixed(0)}K` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <a href={data.polymarketUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--text-dim)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--border)", padding: "10px 20px", display: "inline-block" }}>
            POLYMARKET ↗
          </a>
        </div>
      </div>
    </div>
  );
}
