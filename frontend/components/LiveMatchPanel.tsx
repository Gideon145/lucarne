"use client";

import { useEffect, useState, useCallback } from "react";
import { POLYBOT_URL, SIGNAL_ATTESTOR, MATCH_SIGNAL_ATTESTOR, OKLINK_BASE } from "@/lib/constants";
import PredictionPanel from "./PredictionPanel";
import BetPanel from "./BetPanel";

// Local Vercel route — no Railway dependency for odds data
const LOCAL_LIVE_MATCH_URL = "/api/live-match";

// Pre-match odds snapshot — locked on-chain before kickoff.
// Stored here because once a Polymarket market resolves it returns settlement
// prices (99.8% / 0.2%), not the actual pre-match probabilities.
const PRE_MATCH_ODDS: Record<string, { home: number; draw: number; away: number }> = {
  "uel-scf-ast-2026-05-20":      { home: 16.5, draw: 24.5, away: 59.5 },
  "ned-ere-ajx-grn-2026-05-21":  { home: 51.2, draw: 24.2, away: 24.6 },
  "sea-fio-ata-2026-05-24":      { home: 33.0, draw: 25.0, away: 42.0 },
};

// ── Multi-game config ─────────────────────────────────────────────────────────
interface TrackedGame { slug: string; label: string; date: string; resolved: boolean; }
const TRACKED_GAMES: TrackedGame[] = [
  { slug: "uel-scf-ast-2026-05-20",     label: "UEL FINAL",    date: "MAY 20", resolved: true  },
  { slug: "ned-ere-ajx-grn-2026-05-21", label: "EREDIVISIE PO", date: "MAY 21", resolved: true  },
  { slug: "sea-fio-ata-2026-05-24",     label: "SERIE A",      date: "MAY 22", resolved: true  },
  { slug: "sea-int-bol-2026-05-23",     label: "DFB POKAL",   date: "MAY 23", resolved: true  },
  { slug: "lla-bar-val-2026-05-23",     label: "LA LIGA",      date: "MAY 23", resolved: true  },
];

// Static match data for games not on Polymarket (or as reliable fallback).
const STATIC_GAMES: Record<string, LiveMatchData> = {
  "uel-scf-ast-2026-05-20": {
    slug: "uel-scf-ast-2026-05-20", eventId: "static-uel-scf-ast",
    title: "SC Freiburg vs. Aston Villa",
    description: "UEFA Europa League 2025/26 Final",
    endDate: "2026-05-20T19:00:00Z",
    active: false, closed: true,
    volume: 1840000, liquidity: 0, volume24hr: 0, competitive: 0,
    markets: [
      { question: "SC Freiburg win?", slug: "scf-win",  prob:  0.1, marketId: "s1" },
      { question: "Draw?",            slug: "uel-draw", prob:  0.1, marketId: "s2" },
      { question: "Aston Villa win?", slug: "ast-win",  prob: 99.8, marketId: "s3" },
    ],
    polymarketUrl: "https://polymarket.com/event/uel-scf-ast-2026-05-20",
    brief: "", homeNation: "GER", awayNation: "ENG",
    gameId: "0xc281fcc54207a47559fb518c2f99673f1784919931ab51fab71fcc6729f4d482",
    signalTxHash:  "0x4e98f3c011ad8c512acc61805550658208370674dd82b8d3820706384aa33f65",
    resolvedTxHash: "0x48de570075c862184c854d2ad0ca4c8ea2666808fb05e1e55310368968cd9467",
    signalCorrect: true,
  },
  "ned-ere-ajx-grn-2026-05-21": {
    slug: "ned-ere-ajx-grn-2026-05-21", eventId: "static-ajx-grn",
    title: "Ajax vs. Groningen",
    description: "Dutch Eredivisie — Conference League Play-offs Semi-final",
    endDate: "2026-05-21T16:45:00Z",
    active: false, closed: true,
    volume: 0, liquidity: 0, volume24hr: 0, competitive: 0,
    markets: [
      { question: "Ajax win?",      slug: "ajx-win",  prob: 99.8, marketId: "s4" },
      { question: "Draw?",          slug: "ajx-draw", prob:  0.1, marketId: "s5" },
      { question: "Groningen win?", slug: "grn-win",  prob:  0.1, marketId: "s6" },
    ],
    polymarketUrl: "",
    brief: "", homeNation: "NED", awayNation: "NED",
    gameId: "0xe055f62b2b266bf46db7c04a4cb083e1cd169e103c8c8dff960d34e05420c4a4",
    proofTxHash: "0x43dc866227d4b93a4a4bae3c6706c5a1d032309aa46e03390ecf9d677115c8fb",
    signalTxHash: "0x38e3c6cd2e8abe7833839b0840c1ab8bda5afb33ea52879483288fb9dfd62daa",
  },
  "sea-fio-ata-2026-05-24": {
    slug: "sea-fio-ata-2026-05-24", eventId: "static-fio-ata",
    title: "Fiorentina vs. Atalanta",
    description: "Italian Serie A — Matchday 37",
    endDate: "2026-05-22T18:45:00Z",
    active: false, closed: true,
    volume: 0, liquidity: 0, volume24hr: 0, competitive: 0,
    markets: [
      { question: "Fiorentina win?", slug: "fio-win",  prob: 33.0, marketId: "s7" },
      { question: "Draw?",           slug: "sea-draw", prob: 25.0, marketId: "s8" },
      { question: "Atalanta win?",   slug: "ata-win",  prob: 42.0, marketId: "s9" },
    ],
    polymarketUrl: "https://polymarket.com/sports/sea/sea-fio-ata-2026-05-24",
    brief: "Atalanta (7th, 58 pts) travel to Artemio Franchi needing a result for Conference League football. Fiorentina (15th) hold home advantage and beat Atalanta 1-0 here in March. Both squads in inconsistent late-season form. Market edges Atalanta at 42% but the home factor keeps this open.",
    homeNation: "ITA", awayNation: "ITA",
    gameId: "0x24ba1da38dccf3520be37c13283e854e5d1f2605a1f01f983193f41d58372e89",
    proofTxHash: "0xe3553d8e0242baddac7db1256bf5f16aff3ee79c1c128051886ad036a76d3dd2",
    signalTxHash: "0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5",
    signalCorrect: false,
    actualResult: "DRAW",
  },
  "sea-int-bol-2026-05-23": {
    slug: "sea-int-bol-2026-05-23", eventId: "static-bay-stt",
    title: "Bayern Munich vs. Stuttgart",
    description: "DFB Pokal Final 2025/26",
    endDate: "2026-05-23T17:00:00Z",
    active: false, closed: true,
    volume: 0, liquidity: 0, volume24hr: 0, competitive: 0,
      { question: "Bayern win?",    slug: "bay-win",  prob: 65.0, marketId: "s10" },
      { question: "Draw?",          slug: "bay-draw", prob: 20.0, marketId: "s11" },
      { question: "Stuttgart win?", slug: "stt-win",  prob: 15.0, marketId: "s12" },
      { question: "Bologna win?", slug: "bol-win",  prob: 15.0, marketId: "s12" },
    ],
    polymarketUrl: "",
    brief: "Bayern Munich face Stuttgart in the DFB Pokal Final at Berlin Olympiastadion. Lucarne signal locked Bayern as a high-conviction call before kickoff.",
    homeNation: "GER", awayNation: "GER",
    gameId: "0x844d508ea2b7fa3dae588dfed6d809995b04f5729d7595a20f011fd3b841d528",
    signalTxHash: "0x81ad7e719a192354a2f76d460b83d95110607031c1571ca72692d106cbfeb0d7",
    proofTxHash: "0xe2bd4b93051056ba9638048e776d8b54336e5816a4733edddf7ed53bee860f7f",
    proofTxHash: "0xe2bd4b93051056ba9638048e776d8b54336e5816a4733edddf7ed53bee860f7f",
    signalCorrect: true,
    actualResult: "3-0 BAYERN WIN",
  "lla-bar-val-2026-05-23": {
    slug: "lla-bar-val-2026-05-23", eventId: "static-rma-ath",
    title: "Real Madrid vs. Athletic Club",
    description: "La Liga — Matchday 38",
    endDate: "2026-05-23T19:00:00Z",
    active: false, closed: true,
    volume: 0, liquidity: 0, volume24hr: 0, competitive: 0,
      { question: "Real Madrid win?",   slug: "rma-win",  prob: 68.0, marketId: "s13" },
      { question: "Draw?",              slug: "rma-draw", prob: 20.0, marketId: "s14" },
      { question: "Athletic Club win?", slug: "ath-win",  prob: 12.0, marketId: "s15" },
      { question: "Valencia win?",  slug: "val-win",  prob: 12.0, marketId: "s15" },
    ],
    polymarketUrl: "",
    brief: "Real Madrid close their La Liga campaign at the Santiago Bernabeu against Athletic Club. Lucarne signal locked Real Madrid at 68% before kickoff.",
    homeNation: "ESP", awayNation: "ESP",
    gameId: "0x2411ce7f1f9d924781472689184677c1a3c57703b61f51c55752f713d997a0c0",
    signalTxHash: "0xeec67755b145f961c35bfbf93c80a5b52232abcea71716e4ed1eb1f3555c29e5",
    proofTxHash: "0x54e2e03f4e8196424c17df2a4aa56a680089ff3484dda4fc1fdb658b559f4b40",
    proofTxHash: "0x54e2e03f4e8196424c17df2a4aa56a680089ff3484dda4fc1fdb658b559f4b40",
    signalCorrect: true,
    actualResult: "4-2 REAL MADRID WIN",
};

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
  gameId?:        string;
  proofTxHash?:   string;
  signalTxHash?:  string;
  resolvedTxHash?: string;   // MatchResultAttestor resolve() tx
  signalCorrect?:  boolean;  // was the pre-match signal call right?
  actualResult?:   "HOME_WIN" | "DRAW" | "AWAY_WIN";  // actual FT result
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
  // Draw: question explicitly says "draw"
  const drawM = markets.find((m) => m.question.toLowerCase().includes("draw"));

  // Win markets only — excludes the draw question which mentions both team names
  const winMarkets = markets.filter((m) => m.question.toLowerCase().includes(" win"));

  // Pick the most meaningful word from team name (skip short words and "FC"/"CF"/"SC")
  const sig = (name: string) =>
    name.split(" ").find((w) => w.length > 2 && !["FC","CF","SC","AFC","RFC"].includes(w.toUpperCase()))
    ?? name.slice(0, 6);

  const homeKey = sig(homeTeam).toLowerCase();
  const awayKey = sig(awayTeam).toLowerCase();

  const homeM = winMarkets.find((m) => m.question.toLowerCase().includes(homeKey));
  const awayM = winMarkets.find((m) => m.question.toLowerCase().includes(awayKey));

  return {
    homeProb: homeM?.prob ?? winMarkets[0]?.prob ?? 33,
    drawProb: drawM?.prob ?? 33,
    awayProb: awayM?.prob ?? winMarkets[1]?.prob ?? 33,
  };
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
  const defaultSlug = TRACKED_GAMES.find(g => !g.resolved)?.slug ?? TRACKED_GAMES[TRACKED_GAMES.length - 1].slug;
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Reset data when switching games
  useEffect(() => {
    setData(null);
    setError(false);
  }, [selectedSlug]);

  const fetchMatch = useCallback(async () => {
    // Use static data if available (games not on Polymarket, or reliable fallback)
    if (STATIC_GAMES[selectedSlug]) {
      setData(STATIC_GAMES[selectedSlug]);
      setLastUpdate(new Date());
      setError(false);
      return;
    }
    try {
      // Primary: Vercel /api/live-match (always available)
      const res = await fetch(`${LOCAL_LIVE_MATCH_URL}?slug=${encodeURIComponent(selectedSlug)}`, { cache: "no-store" });
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
  }, [selectedSlug]);

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
  // Market is effectively resolved when the winning prob ≥ 99%
  const isResolved = data.closed || favProb >= 99;
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
      {/* Game selector tab bar — expanded view only */}
      {expanded && (
        <div style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          marginLeft: -40,
          marginRight: -40,
          marginTop: -32,
          marginBottom: 28,
          paddingLeft: 40,
        }}>
          {TRACKED_GAMES.map((game) => {
            const active = selectedSlug === game.slug;
            return (
              <button
                key={game.slug}
                onClick={() => setSelectedSlug(game.slug)}
                style={{
                  padding: "10px 20px",
                  background: active ? "rgba(0,255,133,0.05)" : "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
                  color: active ? "var(--green)" : "var(--text-dim)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  letterSpacing: "0.13em",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 3,
                }}
              >
                <span style={{
                  fontSize: 9,
                  color: game.resolved ? "var(--text-faint)" : active ? "var(--amber)" : "var(--text-faint)",
                  letterSpacing: "0.18em",
                }}>
                  {game.date} {game.resolved ? "✓ FT" : "● UPCOMING"}
                </span>
                <span>{game.label}</span>
              </button>
            );
          })}
        </div>
      )}
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
              background: isResolved ? "var(--text-dim)" : isLive ? "var(--green)" : "var(--amber)",
              boxShadow: isResolved ? "none" : isLive ? "0 0 8px var(--green)" : "0 0 8px var(--amber)",
              animation: !isResolved && isLive ? "pulse 1.4s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: isResolved ? "var(--text-dim)" : isLive ? "var(--green)" : "var(--amber)",
            }}
          >
            {isResolved ? "FULL TIME" : isLive ? "LIVE MATCH" : "PRE-MATCH"}
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
          {/* Market volume — only if we have Polymarket data */}
          {data.volume > 0 && (
            <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
              ${(data.volume / 1000).toFixed(0)}K vol · ${(data.liquidity / 1000).toFixed(0)}K liq
            </span>
          )}
          {data.volume === 0 && (
            <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
              odds via BetExplorer
            </span>
          )}
          {lastUpdate && (
            <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace" }}>
              ↻ {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          {data.polymarketUrl && (
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
          )}
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

      {/* ── Expanded: full analysis or result card ───────────────── */}
      {expanded && isResolved && (
        <ResultView data={data} home={home} away={away}
          homeProb={homeProb} drawProb={drawProb} awayProb={awayProb}
          winner={favourite} winnerProb={favProb} loser={underdog} loserProb={underdogProb} />
      )}
      {expanded && !isResolved && <ExpandedView data={data} home={home} away={away}
        homeProb={homeProb} drawProb={drawProb} awayProb={awayProb}
        isLive={isLive} slug={data.slug} />}
    </div>
  );
}

// ── Result card (shown when market resolves) ──────────────────────────────────

function ResultView({
  data, home, away,
  winner, loser, loserProb,
}: {
  data: LiveMatchData; home: string; away: string;
  homeProb: number; drawProb: number; awayProb: number;
  winner: string; winnerProb: number; loser: string; loserProb: number;
}) {
  const date = new Date(data.endDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  // Use hardcoded pre-match odds — live data reflects settlement price (99.8%), not signal odds
  const snap = PRE_MATCH_ODDS[data.slug];
  const preHome  = snap?.home ?? 33;
  const preDraw  = snap?.draw ?? 33;
  const preAway  = snap?.away ?? 33;
  const preWinnerProb = home === winner ? preHome : preAway;

  return (
    <div style={{ marginTop: 40 }}>

      {/* ── FULL TIME hero ─────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.25em", marginBottom: 16 }}>
          {data.slug.split("-")[0].toUpperCase()} · {date} · FULL TIME
        </div>
        <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 42, fontWeight: 900, letterSpacing: "0.08em", color: "var(--text-primary)", lineHeight: 1.2, marginBottom: 32 }}>
          {home}
          <span style={{ color: "var(--text-faint)", margin: "0 24px", fontWeight: 300 }}>vs</span>
          {away}
        </div>

        {/* Winner / Draw banner */}
        {data.actualResult === "DRAW" ? (
          <div style={{
            display: "inline-block",
            border: "2px solid var(--amber)",
            padding: "20px 48px",
            background: "rgba(240,180,41,0.05)",
            boxShadow: "0 0 40px rgba(240,180,41,0.12)",
          }}>
            <div style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 10 }}>
              RESULT CONFIRMED
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 32, fontWeight: 900, color: "var(--amber)", letterSpacing: "0.1em" }}>
              DRAW
            </div>
          </div>
        ) : (
          <div style={{
            display: "inline-block",
            border: "2px solid var(--green)",
            padding: "20px 48px",
            background: "rgba(0,255,133,0.05)",
            boxShadow: "0 0 40px rgba(0,255,133,0.15)",
          }}>
            <div style={{ fontSize: 12, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 10 }}>
              ✓ RESULT CONFIRMED
            </div>
            <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 32, fontWeight: 900, color: "var(--green)", letterSpacing: "0.1em", textShadow: "0 0 24px var(--green-glow)" }}>
              {winner.toUpperCase()} WIN
            </div>
          </div>
        )}
      </div>

      {/* ── Signal called it / wrong ──────────────────────────────── */}
      {data.signalCorrect === false ? (
        <div style={{ border: "1px solid rgba(224,82,82,0.4)", borderLeft: "4px solid #e05252", padding: "28px 32px", marginBottom: 40, background: "rgba(224,82,82,0.04)" }}>
          <div style={{ fontSize: 13, color: "#e05252", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 16 }}>
            ✗ SIGNAL WRONG
          </div>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-primary)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Lucarne called <strong style={{ color: "#e05252" }}>{winner}</strong> to win.
            The result was{" "}
            <strong style={{ color: "var(--amber)" }}>{data.actualResult === "DRAW" ? "a draw" : "the other side"}</strong>.
            The signal was wrong — the stake is gone. Every call is locked on-chain before kickoff,
            settled trustlessly after FT. We don&apos;t bury bad calls.{" "}
            <strong>The ledger doesn&apos;t lie.</strong>
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(0,255,133,0.3)", borderLeft: "4px solid var(--green)", padding: "28px 32px", marginBottom: 40, background: "rgba(0,255,133,0.04)" }}>
          <div style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.2em", marginBottom: 16 }}>
            ✓ SIGNAL CALLED IT
          </div>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-primary)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Before kickoff, Lucarne&apos;s signal engine had{" "}
            <strong style={{ color: "var(--green)" }}>{winner}</strong> as the clear market favourite at{" "}
            <strong style={{ color: "var(--green)" }}>{preWinnerProb.toFixed(1)}%</strong> implied probability.
            That signal was computed, attested, and locked on{" "}
            <strong>X Layer mainnet</strong> — immutable before the whistle blew.{" "}
            <strong style={{ color: "var(--green)" }}>It cannot be edited. The record stands forever.</strong>
          </p>
        </div>
      )}

      {/* ── Pre-match signal snapshot ──────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 20 }}>
          PRE-MATCH SIGNAL SNAPSHOT · LOCKED ON-CHAIN
        </div>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)" }}>
          {[
            { label: `${home.toUpperCase()} WIN`, prob: preHome, won: data.actualResult === "HOME_WIN" || (!data.actualResult && home === winner) },
            { label: "DRAW",                       prob: preDraw, won: data.actualResult === "DRAW" },
            { label: `${away.toUpperCase()} WIN`,  prob: preAway, won: data.actualResult === "AWAY_WIN" || (!data.actualResult && away === winner) },
          ].map(({ label, prob, won }, i) => (
            <div key={label} style={{
              flex: 1,
              textAlign: "center",
              padding: "28px 20px",
              borderLeft: i > 0 ? "1px solid var(--border)" : "none",
              background: won ? "rgba(0,255,133,0.04)" : "transparent",
              borderTop: won ? "3px solid var(--green)" : "3px solid transparent",
            }}>
              <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 48, fontWeight: 900, lineHeight: 1, marginBottom: 12,
                color: won ? "var(--green)" : i === 1 ? "var(--amber)" : "var(--text-faint)",
                textShadow: won ? "0 0 24px var(--green-glow)" : "none",
              }}>
                {prob.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: won ? 8 : 0 }}>
                {label}
              </div>
              {won && (
                <div style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em" }}>
                  ✓ CORRECT
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", textAlign: "right" }}>
          Source: Polymarket · attested via Lucarne SignalAttestor on X Layer before kickoff
        </div>
      </div>

      {/* ── Signal Pool — settle + NFT mint accessible from result view ─── */}
      <BetPanel slug={data.slug} home={home} away={away} />

      {/* ── Community predictions (resolved — show results, no submit) */}
      <PredictionPanel slug={data.slug} home={home} away={away} isResolved={true} />

      {/* ── Signal verdict ─────────────────────────────────────── */}
      {data.resolvedTxHash != null && (
        <div style={{
          border: `1px solid ${data.signalCorrect ? "var(--green)" : "#e05252"}`,
          padding: "20px 28px",
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          background: data.signalCorrect ? "rgba(0,255,133,0.04)" : "rgba(224,82,82,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{
              fontSize: 28,
              fontFamily: "var(--font-orbitron), sans-serif",
              fontWeight: 900,
              color: data.signalCorrect ? "var(--green)" : "#e05252",
              letterSpacing: "0.05em",
            }}>
              {data.signalCorrect ? "✓ SIGNAL CORRECT" : "✗ SIGNAL WRONG"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.7 }}>
              Pre-kickoff call locked on-chain · verified after result<br />
              Computed by MatchResultAttestor against MatchSignalAttestor
            </div>
          </div>
          <a
            href={`${OKLINK_BASE}/tx/${data.resolvedTxHash}`}
            target="_blank" rel="noreferrer"
            style={{
              fontSize: 13,
              color: data.signalCorrect ? "var(--green)" : "#e05252",
              textDecoration: "none",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.1em",
              border: `1px solid ${data.signalCorrect ? "var(--green)" : "#e05252"}`,
              padding: "10px 20px",
              display: "inline-block",
            }}>
            VERDICT TX ↗
          </a>
        </div>
      )}

      {/* ── On-chain proof ─────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 40, display: "flex", alignItems: "flex-start", gap: 36, flexWrap: "wrap", background: "rgba(6,15,9,0.6)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>SIGNAL CONTRACT</div>
          <a href={`${OKLINK_BASE}/address/${MATCH_SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}>
            {MATCH_SIGNAL_ATTESTOR.slice(0, 12)}…{MATCH_SIGNAL_ATTESTOR.slice(-6)} ↗
          </a>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>CHAIN</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono), monospace" }}>X Layer Mainnet · chainId 196</div>
        </div>
        {data.gameId && (
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>GAME ID · keccak256("{data.slug}")</div>
            <div style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", wordBreak: "break-all", marginBottom: 10 }}>{data.gameId}</div>
            {data.signalTxHash && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Signal tx encodes: homeProb · drawProb · awayProb<br />
                signalScore · signalCall · dataHash (inputs provenance)
              </div>
            )}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          {data.signalTxHash && (
            <a href={`${OKLINK_BASE}/tx/${data.signalTxHash}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--green)", padding: "10px 20px", display: "inline-block" }}>
              SIGNAL TX ↗
            </a>
          )}
          {data.proofTxHash && (
            <a href={`${OKLINK_BASE}/tx/${data.proofTxHash}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "var(--amber)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--amber)", padding: "10px 20px", display: "inline-block" }}>
              SAMPLE PREDICTION TX ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Bottom: market stats ───────────────────────────────────── */}
      <div style={{ display: "flex", gap: 40, paddingTop: 28, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
        {[
          { label: "WINNER",         value: winner },
          { label: "PRE-MATCH ODDS", value: `${preWinnerProb.toFixed(1)}% fav` },
          { label: "UNDERDOG ODDS",  value: `${loser} · ${(home === loser ? preHome : preAway).toFixed(1)}%` },
          { label: "TOTAL VOLUME",   value: `$${(data.volume / 1000).toFixed(0)}K` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <a href={data.polymarketUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--green)", padding: "10px 20px", display: "inline-block" }}>
            POLYMARKET RESULT ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Expanded view ──────────────────────────────────────────────────────────────

function ExpandedView({
  data, home, away, homeProb, drawProb, awayProb, isLive, slug,
}: {
  data: LiveMatchData; home: string; away: string;
  homeProb: number; drawProb: number; awayProb: number;
  isLive: boolean; slug: string;
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
        {slug === "ned-ere-ajx-grn-2026-05-21" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Ajax carry significant individual quality — a squad built on quick combination play and clinical finishing. Groningen, who earned promotion, face a major step-up. Their pressing game can disrupt, but Ajax&apos;s technical superiority and defensive organisation is clear at this level.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>KEY MATCHUP</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Ajax&apos;s central midfield vs Groningen&apos;s compact defensive block. Odds sit remarkably tight at 51-24-25 — the market sees genuine risk. Groningen&apos;s main threat is transition; a high Ajax defensive line creates their best opportunity to nick a result.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SIGNAL LEAN</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Lucarne&apos;s composite score — weighted heavily toward odds momentum — agrees with the market: Ajax are marginal favourites at 51.2%. The unusual balance signals market uncertainty. This is not a banker — it&apos;s a live contest where any outcome is credible.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>OUTCOME WATCH</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Most likely: <strong style={{ color: "var(--text-primary)" }}>Ajax win in normal time (51%)</strong>. The draw/Groningen paths combined at ~49% are unusually high for this matchup. A cagey first half is expected, then Ajax&apos;s quality tells. Conference League football is on the line for both sides.
              </p>
            </div>
          </div>
        ) : slug === "sea-int-bol-2026-05-23" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Bayern Munich have been Germany's dominant force all season. In the DFB Pokal Final at Berlin's Olympiastadion, they face a Stuttgart side that had an impressive cup run but face a step up in class. The individual quality gap between these squads is significant — Bayern's depth and experience in finals make this a high-conviction call.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>KEY MATCHUP</div>
<p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Bayern's pressing system and technical midfield vs Stuttgart's compact defensive shape. Stuttgart's best result requires a clean sheet and counter-attack execution at elite level — unlikely against a Bayern side that has averaged over 2.5 goals per game in knockout football this season.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SIGNAL LEAN</div>
<p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Lucarne composite score lands at <strong style={{ color: "var(--text-primary)" }}>62</strong> — a clear HOME signal. Odds weight (65% x 0.55), gate (0.30), and form (0.15) all align on Bayern. Cup final pressure only adds to their motivation.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>OUTCOME WATCH</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Most likely: <strong style={{ color: 'var(--text-primary)' }}>Bayern win in normal time (65%)</strong>. Stuttgart's best case is a draw forcing extra time, but Bayern's bench depth and fitness advantage makes that the less likely path. Final-day pressure at a neutral venue favours the more experienced side.
              </p>
            </div>
          </div>
        ) : slug === "lla-bar-val-2026-05-23" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Real Madrid's squad has been one of the strongest in La Liga this season. At the Santiago Bernabeu on the final day, they face an Athletic Club side that qualified for Europe but arrives as a significant underdog. Madrid's depth, home advantage, and motivation to finish strong make this a clear home signal.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>KEY MATCHUP</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Madrid's attacking fluidity vs Athletic Club's high defensive line. Athletic's best path is a fast counter — but the Bernabeu atmosphere and Madrid's transitional speed make that a difficult proposition. The 68% home probability reflects strong market and model alignment.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SIGNAL LEAN</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Lucarne composite score reaches <strong style={{ color: 'var(--text-primary)' }}>65</strong> — the highest of any club game this cycle. Odds (68% x 0.55), gate (63 x 0.30), and form (58 x 0.15) all align. Model, market, and form data point to the same outcome.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>OUTCOME WATCH</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Most likely: <strong style={{ color: 'var(--text-primary)' }}>Real Madrid win at the Bernabeu (68%)</strong>. Draw is the main risk at 20% if Athletic park the bus. Athletic win at 12% is the tail risk. Final-day energy at the Bernabeu makes a home performance the clear base case.
              </p>
            </div>
          </div>
        ) : slug === "sea-fio-ata-2026-05-24" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Atalanta hold the individual quality edge — Scamacca and De Ketelaere lead a side that spent much of the season in European contention, finishing 7th with 58 pts. Fiorentina&apos;s squad is more than capable at home but their late-season motivation is limited with European football out of reach. The 17-point table gap tells the story in quality terms.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>KEY MATCHUP</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Atalanta&apos;s technical midfield against Fiorentina&apos;s defensive organisation at the Artemio Franchi. Fiorentina beat Atalanta 1-0 here in March with a disciplined low block. Atalanta&apos;s best path through is wide — their wing threat is the clearest edge against a compact home defence.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SIGNAL LEAN</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Lucarne&apos;s composite score aligns with the market:{" "}
                <strong style={{ color: "var(--text-primary)" }}>Atalanta are the narrow favourite at 42%</strong>. However the home factor and Fiorentina&apos;s recent H2H record at this ground closes the gap significantly. Both teams in inconsistent late-season form — the signal does not strongly favour either outcome.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>OUTCOME WATCH</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Most likely: <strong style={{ color: "var(--text-primary)" }}>Atalanta win or draw (67% combined)</strong>. But Fiorentina have beaten Atalanta here before and a home upset is live at 33%. A cagey, tight contest is expected — if it&apos;s level at 60 mins, Atalanta&apos;s need for Conference League football means they push hard. The result matters far more to one side.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 8 }}>SQUAD DEPTH EDGE</div>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Aston Villa carry the deeper European pedigree here — Emery&apos;s squad has navigated the UEL knockout rounds with disciplined structure and a clinical attack. Freiburg&apos;s strength is collective: a high-press system that punishes mistakes, but they&apos;re outgunned in individual quality at the top end.
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
        )}
      </div>

      {/* ── Community predictions ──────────────────────────────────── */}
      <PredictionPanel slug={data.slug} home={home} away={away} isResolved={false} />

      {/* ── Signal Pool — bet against (or with) Lucarne ────────────── */}
      <BetPanel slug={data.slug} home={home} away={away} />

      {/* ── How Lucarne is different ────────────────────────────────── */}
      <div style={{ border: "1px solid rgba(0,255,133,0.2)", borderLeft: "4px solid var(--green)", padding: "24px 28px", marginBottom: 32, background: "rgba(0,255,133,0.025)" }}>
        <div style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.18em", marginBottom: 14 }}>
          WHY THIS MATTERS — THE LUCARNE DIFFERENCE
        </div>
        {slug === "ned-ere-ajx-grn-2026-05-21" ? (
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Ajax vs Groningen is exactly the kind of match Lucarne was built for. Before kickoff, our signal engine already computed its reading and{" "}
            <strong style={{ color: "var(--text-primary)" }}>locked it on-chain — immutable, timestamped, permanent</strong>.
            The market puts this at a remarkable 51/24/25 — genuine uncertainty about who wins. Lucarne&apos;s composite score captures that balance.{" "}
            <strong style={{ color: "var(--text-primary)" }}>No one can edit what was attested</strong>.
            Whatever happens today, the signal that existed at kickoff lives on X Layer mainnet forever.
            That&apos;s not prediction — that&apos;s <strong style={{ color: "var(--text-primary)" }}>proof</strong>.
          </p>
        ) : slug === "sea-int-bol-2026-05-23" ? (
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Bayern vs Stuttgart is exactly the kind of signal Lucarne was built to capture. Before kickoff, our engine read the market at{
            <strong style={{ color: "var(--text-primary)" }}>Bayern 65% &middot; Draw 20% &middot; Stuttgart 15%</strong>{
            and locked that reading on-chain &mdash; immutable, timestamped, permanent. Bayern&apos;s experience in finals, squad depth, and consistent form all compound into a high-conviction signal.{
            <strong style={{ color: "var(--text-primary)" }}>No one can edit what was attested</strong>.
            The signal lived on X Layer mainnet before kickoff. Bayern won 3-0. That&apos;s not prediction &mdash; that&apos;s <strong style={{ color: 'var(--text-primary)' }}>proof</strong>.
            That&apos;s not prediction — that&apos;s <strong style={{ color: "var(--text-primary)" }}>proof</strong>.
          </p>
        ) : slug === "lla-bar-val-2026-05-23" ? (
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Real Madrid vs Athletic Club is a high-conviction signal from Lucarne. Our engine read the market at{
            <strong style={{ color: "var(--text-primary)" }}>Real Madrid 68% &middot; Draw 20% &middot; Athletic Club 12%</strong>{
            and locked a signal score of <strong style={{ color: "var(--text-primary)" }}>65</strong> on-chain before kickoff &mdash; immutable, timestamped, permanent. When odds, gate, and form data all align this cleanly, the model has no ambiguity.{
            <strong style={{ color: "var(--text-primary)" }}>No one can edit what was attested</strong>.
            The signal lived on X Layer mainnet before kickoff. Real Madrid won 4-2. That&apos;s not prediction &mdash; that&apos;s <strong style={{ color: 'var(--text-primary)' }}>proof</strong>.
            That&apos;s not prediction — that&apos;s <strong style={{ color: "var(--text-primary)" }}>proof</strong>.
          </p>
        ) : slug === "sea-fio-ata-2026-05-24" ? (
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace", lineHeight: 2 }}>
            Fiorentina vs Atalanta is exactly the kind of signal Lucarne was built to capture. Before kickoff, our engine read the market at{" "}
            <strong style={{ color: "var(--text-primary)" }}>Atalanta 42% · Draw 25% · Fiorentina 33%</strong>{" "}
            and locked that reading on-chain — immutable, timestamped, permanent. Atalanta are chasing Conference League football;
            Fiorentina have home advantage and a recent win at this ground. The signal captures the tension: a close contest where motivation, venue, and form all point in different directions.{" "}
            <strong style={{ color: "var(--text-primary)" }}>No one can edit what was attested</strong>.
            Whatever the result, the signal that existed at kickoff lives on X Layer mainnet forever.
            That&apos;s not prediction — that&apos;s <strong style={{ color: "var(--text-primary)" }}>proof</strong>.
          </p>
        ) : (
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
        )}
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
      <div style={{ border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 32, display: "flex", alignItems: "flex-start", gap: 36, flexWrap: "wrap", background: "rgba(6,15,9,0.6)" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>SIGNAL CONTRACT</div>
          <a href={`${OKLINK_BASE}/address/${MATCH_SIGNAL_ATTESTOR}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono), monospace", textDecoration: "none" }}>
            {MATCH_SIGNAL_ATTESTOR.slice(0, 12)}…{MATCH_SIGNAL_ATTESTOR.slice(-6)} ↗
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
        {data.gameId && (
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.15em", marginBottom: 8 }}>GAME ID · keccak256("{data.slug}")</div>
            <div style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono), monospace", wordBreak: "break-all", marginBottom: 10 }}>{data.gameId}</div>
            {data.signalTxHash && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", lineHeight: 1.8 }}>
                Signal tx encodes: homeProb · drawProb · awayProb<br />
                signalScore · signalCall · dataHash (inputs provenance)
              </div>
            )}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          {data.signalTxHash && (
            <a href={`${OKLINK_BASE}/tx/${data.signalTxHash}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "var(--green)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--green)", padding: "10px 20px", display: "inline-block" }}>
              SIGNAL TX ↗
            </a>
          )}
          {data.proofTxHash && (
            <a href={`${OKLINK_BASE}/tx/${data.proofTxHash}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "var(--amber)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--amber)", padding: "10px 20px", display: "inline-block" }}>
              SAMPLE PREDICTION TX ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Bottom stats ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 40, paddingTop: 28, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
        {[
          { label: "MARKET FAVOURITE", value: favourite },
          { label: "IMPLIED WIN PROB",  value: `${favProb.toFixed(1)}%` },
          { label: "UNDERDOG",          value: `${underdog} · ${underdogProb.toFixed(1)}%` },
          ...(data.volume > 0 ? [
            { label: "TOTAL VOLUME",   value: `$${(data.volume / 1000).toFixed(0)}K` },
            { label: "OPEN LIQUIDITY", value: `$${(data.liquidity / 1000).toFixed(0)}K` },
          ] : []),
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 16, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
        {data.polymarketUrl && (
          <div style={{ marginLeft: "auto" }}>
            <a href={data.polymarketUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, color: "var(--text-dim)", textDecoration: "none", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.1em", border: "1px solid var(--border)", padding: "10px 20px", display: "inline-block" }}>
              POLYMARKET ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
