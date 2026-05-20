import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
// Default to today's UEL match; override via LIVE_MATCH_SLUG env var
const DEFAULT_SLUG = process.env.LIVE_MATCH_SLUG ?? "uel-scf-ast-2026-05-20";

// Maps Polymarket team abbreviations (from slug) → Lucarne nation ISO3 codes
// Add entries here when rotating to a new daily match
const TEAM_NATION_MAP: Record<string, string> = {
  // Club → home nation (for signal lookup in Lucarne)
  scf: "GER",  // SC Freiburg
  ast: "ENG",  // Aston Villa
  atm: "ESP",  // Atletico Madrid
  bvb: "GER",  // Borussia Dortmund
  fcb: "GER",  // Bayern Munich
  bar: "ESP",  // Barcelona
  rma: "ESP",  // Real Madrid
  liv: "ENG",  // Liverpool
  mci: "ENG",  // Man City
  mun: "ENG",  // Man Utd
  ars: "ENG",  // Arsenal
  chel: "ENG", // Chelsea
  tot: "ENG",  // Tottenham
  juv: "ITA",  // Juventus
  int: "ITA",  // Inter Milan
  mil: "ITA",  // AC Milan
  psg: "FRA",  // PSG
  ole: "FRA",  // Marseille / Olympique Lyonnais
  ben: "POR",  // Benfica
  por: "POR",  // Porto
  spo: "POR",  // Sporting
  ajax: "NED", // Ajax
  fen: "TUR",  // Fenerbahce
  gal: "TUR",  // Galatasaray
};

export const runtime = "edge";
export const revalidate = 30; // cache for 30s

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? DEFAULT_SLUG;

  try {
    const res = await fetch(
      `${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`,
      {
        headers: { "User-Agent": "lucarne-frontend/1.0" },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    const data: unknown[] = await res.json();
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ev = data[0] as Record<string, unknown>;
    const markets = (ev.markets as Record<string, unknown>[]) ?? [];

    // Parse each sub-market's YES probability
    const parsed = markets.map((m) => {
      const pricesRaw = m.outcomePrices as string | number[];
      const outcomesRaw = m.outcomes as string | string[];
      const prices: number[] = Array.isArray(pricesRaw)
        ? pricesRaw.map(Number)
        : JSON.parse(String(pricesRaw)).map(Number);
      const outcomes: string[] = Array.isArray(outcomesRaw)
        ? outcomesRaw.map(String)
        : JSON.parse(String(outcomesRaw)).map(String);

      const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
      const prob = yesIdx >= 0 && yesIdx < prices.length ? prices[yesIdx] : prices[0] ?? 0;

      return {
        question: String(m.question ?? ""),
        slug:     String(m.slug ?? ""),
        prob:     Math.round(prob * 1000) / 10, // 1 decimal %
        marketId: String(m.id ?? ""),
      };
    });

    const slugParts = slug.split("-");
    const competition = slugParts[0]?.toUpperCase() ?? "MATCH";

    // Resolve nation codes from slug abbreviations (slugParts[1] = home, slugParts[2] = away)
    const homeAbbr = slugParts[1]?.toLowerCase() ?? "";
    const awayAbbr = slugParts[2]?.toLowerCase() ?? "";
    const homeNation = TEAM_NATION_MAP[homeAbbr] ?? null;
    const awayNation = TEAM_NATION_MAP[awayAbbr] ?? null;

    const result = {
      slug,
      eventId:      String(ev.id ?? ""),
      title:        String(ev.title ?? ""),
      description:  String(ev.description ?? ""),
      endDate:      String(ev.endDate ?? ""),
      active:       Boolean(ev.active),
      closed:       Boolean(ev.closed),
      volume:       Math.round(Number(ev.volume ?? 0)),
      liquidity:    Math.round(Number(ev.liquidity ?? 0)),
      volume24hr:   Math.round(Number(ev.volume24hr ?? 0)),
      competitive:  Number(ev.competitive ?? 0),
      markets:      parsed,
      competition,
      homeNation,   // ISO3 for home team's nation (e.g. "GER")
      awayNation,   // ISO3 for away team's nation (e.g. "ENG")
      polymarketUrl: `https://polymarket.com/sports/${competition.toLowerCase()}/${slug}`,
      brief:        "", // polybot adds this when available
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[live-match]", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
