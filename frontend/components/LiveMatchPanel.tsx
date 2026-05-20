"use client";

import { useEffect, useState, useCallback } from "react";
import { POLYBOT_URL, SIGNAL_ATTESTOR, OKLINK_BASE } from "@/lib/constants";
import type { NationData } from "@/lib/useAttestations";

// Local Vercel route — no Railway dependency for odds data
const LOCAL_LIVE_MATCH_URL = "/api/live-match";

const REGIME_LABELS = ["CALM", "TRENDING", "VOLATILE", "BREAKOUT"] as const;
const REGIME_COLORS = ["#4a6b5c", "#f59e0b", "#ef4444", "#00ff85"] as const;

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

export function LiveMatchPanel({ expanded = false, nations = [] }: { expanded?: boolean; nations?: NationData[] }) {
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
        isLive={isLive} nations={nations} />}
    </div>
  );
}

// ── Expanded view — separated for readability ─────────────────────────────────

function SignalCard({
  label, nation, nationData, marketProb,
}: {
  label: string;
  nation: string | null;
  nationData: NationData | undefined;
  marketProb: number;
}) {
  if (!nation || !nationData) {
    return (
      <div style={{ flex: 1, border: "1px solid var(--border)", padding: "20px 24px", minWidth: 220 }}>
        <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 12 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>No on-chain signal for this club's nation</div>
      </div>
    );
  }

  const regime      = nationData.regime as 0 | 1 | 2 | 3;
  const regimeLabel = REGIME_LABELS[regime];
  const regimeColor = REGIME_COLORS[regime];
  const signalDelta = nationData.score - marketProb;
  const aligned     = Math.abs(signalDelta) <= 10;
  const alignLabel  = aligned ? "ALIGNED" : signalDelta > 0 ? "SIGNAL BULLISH" : "SIGNAL BEARISH";
  const alignColor  = aligned ? "var(--text-dim)" : signalDelta > 0 ? "var(--green)" : "#ef4444";
  const secAgo      = Math.floor(Date.now() / 1000) - nationData.ts;
  const timeAgo     = secAgo < 120 ? `${secAgo}s ago` : secAgo < 3600 ? `${Math.floor(secAgo / 60)}m ago` : `${Math.floor(secAgo / 3600)}h ago`;
  const hashShort   = nationData.signalHash ? nationData.signalHash.slice(0, 10) + "…" : "—";
  const oklink      = `${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`;

  return (
    <div style={{ flex: 1, border: "1px solid var(--border)", borderTop: `3px solid ${regimeColor}`, padding: "20px 24px", minWidth: 220, position: "relative" }}>
      <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 16 }}>
        {label} · LUCARNE SIGNAL
      </div>

      {/* Nation + score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 44, fontWeight: 900, color: regimeColor, lineHeight: 1, textShadow: `0 0 16px ${regimeColor}` }}>
          {nationData.score}
        </div>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>{nation}</div>
          <div style={{ fontSize: 10, color: regimeColor, fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginTop: 2 }}>{regimeLabel}</div>
        </div>
      </div>

      {/* Signal vs market */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>vs market {marketProb.toFixed(1)}%</div>
        <div style={{ fontSize: 10, color: alignColor, fontFamily: "var(--font-mono), monospace", fontWeight: 700, letterSpacing: "0.1em" }}>
          {signalDelta > 0 ? "+" : ""}{signalDelta.toFixed(0)}pt · {alignLabel}
        </div>
      </div>

      {/* On-chain proof */}
      <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 6 }}>ON-CHAIN PROOF</div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", marginBottom: 4 }}>
          hash <span style={{ color: "var(--green)" }}>{hashShort}</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", marginBottom: 8 }}>
          attested {timeAgo}
        </div>
        <a
          href={oklink}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 9, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid rgba(0,255,133,0.3)", padding: "3px 8px" }}
        >
          VERIFY ON X LAYER ↗
        </a>
      </div>
    </div>
  );
}

function ExpandedView({
  data, home, away, homeProb, drawProb, awayProb, isLive, nations,
}: {
  data: LiveMatchData; home: string; away: string;
  homeProb: number; drawProb: number; awayProb: number;
  isLive: boolean; nations: NationData[];
}) {
  const homeNationData = nations.find((n) => n.iso3 === data.homeNation);
  const awayNationData = nations.find((n) => n.iso3 === data.awayNation);
  const favourite      = homeProb > awayProb ? home : away;
  const favProb        = Math.max(homeProb, awayProb);
  const underdog       = homeProb > awayProb ? away : home;
  const underdogProb   = Math.min(homeProb, awayProb);

  return (
    <div style={{ marginTop: 40 }}>

      {/* ── Hero title ─────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 12 }}>
          {data.slug.split("-")[0].toUpperCase()} · {new Date(data.endDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {isLive ? "LIVE NOW" : "PRE-MATCH"}
        </div>
        <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 36, fontWeight: 900, letterSpacing: "0.08em", color: "var(--text-primary)", lineHeight: 1.2 }}>
          {home}
          <span style={{ color: "var(--text-faint)", margin: "0 20px", fontWeight: 300 }}>vs</span>
          {away}
        </div>
      </div>

      {/* ── What makes Lucarne different ───────────────────────────── */}
      <div style={{ border: "1px solid rgba(0,255,133,0.2)", borderLeft: "3px solid var(--green)", padding: "20px 24px", marginBottom: 40, background: "rgba(0,255,133,0.025)" }}>
        <div style={{ fontSize: 10, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 10 }}>
          HOW LUCARNE IS DIFFERENT
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.9 }}>
          Polymarket shows you what the crowd <em>bets</em>. Lucarne shows you what the <strong style={{ color: "var(--text-primary)" }}>signal says — locked on-chain before kickoff</strong>.
          Every 60 seconds, our agent computes a composite score (odds momentum 55% · on-chain gate signal 30% · recent form 15%)
          for every WC 2026 nation and attests it immutably on <strong style={{ color: "var(--text-primary)" }}>X Layer mainnet</strong>.
          No editing, no deleting. The score that existed when the whistle blew is provable forever.
        </p>
      </div>

      {/* ── Three-column: Signal | Odds | Signal ───────────────────── */}
      <div style={{ display: "flex", gap: 20, marginBottom: 40, alignItems: "stretch", flexWrap: "wrap" }}>

        {/* Home nation signal */}
        <SignalCard
          label={home.toUpperCase()}
          nation={data.homeNation}
          nationData={homeNationData}
          marketProb={homeProb}
        />

        {/* Center: market odds */}
        <div style={{ flex: "0 0 220px", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 16 }}>
            POLYMARKET CONSENSUS
          </div>
          {[
            { label: home, prob: homeProb, color: homeProb > awayProb ? "var(--green)" : "var(--text-dim)" },
            { label: "DRAW", prob: drawProb, color: "var(--amber)" },
            { label: away, prob: awayProb, color: awayProb > homeProb ? "var(--green)" : "var(--text-dim)" },
          ].map(({ label, prob, color }) => (
            <div key={label} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>{label}</span>
                <span style={{ fontSize: 14, color, fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700 }}>{prob.toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${prob}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
            ${(data.volume / 1000).toFixed(0)}K traded · ${(data.liquidity / 1000).toFixed(0)}K open
          </div>
        </div>

        {/* Away nation signal */}
        <SignalCard
          label={away.toUpperCase()}
          nation={data.awayNation}
          nationData={awayNationData}
          marketProb={awayProb}
        />
      </div>

      {/* ── On-chain proof banner ───────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", padding: "20px 24px", marginBottom: 40, display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", background: "rgba(6,15,9,0.6)" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 6 }}>SIGNAL CONTRACT</div>
          <a href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}>
            {SIGNAL_ATTESTOR.slice(0, 12)}…{SIGNAL_ATTESTOR.slice(-6)} ↗
          </a>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 6 }}>CHAIN</div>
          <div style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono), monospace" }}>X Layer Mainnet (chainId 196)</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 6 }}>SIGNAL FORMULA</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>
            odds 55% · gate 30% · form 15%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 6 }}>CADENCE</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}>Every 60s · gated by Δscore</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <a href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--green)", padding: "8px 16px", display: "inline-block" }}>
            VIEW ALL ATTESTATIONS ↗
          </a>
        </div>
      </div>

      {/* ── Claude analysis brief ───────────────────────────────────── */}
      {data.brief && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 12 }}>
            AI SIGNAL ANALYSIS
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.9, maxWidth: 800 }}>
            {data.brief}
          </p>
        </div>
      )}

      {/* ── Bottom stats + market link ──────────────────────────────── */}
      <div style={{ display: "flex", gap: 40, paddingTop: 24, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
        {[
          { label: "MARKET FAVOURITE", value: favourite },
          { label: "IMPLIED WIN PROB", value: `${favProb.toFixed(1)}%` },
          { label: "UNDERDOG", value: `${underdog} ${underdogProb.toFixed(1)}%` },
          { label: "24H VOLUME", value: `$${(data.volume24hr / 1000).toFixed(0)}K` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <a href={data.polymarketUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--border)", padding: "8px 16px", display: "inline-block" }}>
            POLYMARKET ↗
          </a>
        </div>
      </div>
    </div>
  );
}
