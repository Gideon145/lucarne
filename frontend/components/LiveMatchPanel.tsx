"use client";

import { useEffect, useState, useCallback } from "react";
import { POLYBOT_URL } from "@/lib/constants";

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

export function LiveMatchPanel() {
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

  if (error || !data) return null;

  const { home, away } = parseTeams(data.title);
  const { homeProb, drawProb, awayProb } = getHomeAwayDraw(data.markets, home, away);
  const favourite = homeProb > awayProb ? home : away;
  const favProb   = Math.max(homeProb, awayProb);

  const isLive    = data.active && !data.closed;
  const matchTime = new Date(data.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(135deg, rgba(0,255,133,0.03) 0%, rgba(255,180,0,0.02) 100%)",
        padding: "16px 24px",
        position: "relative",
        overflow: "hidden",
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
    </div>
  );
}
