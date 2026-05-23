import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const NATIONS = [
  // CONMEBOL
  "ARG","BRA","COL","ECU","PAR","URU",
  // UEFA
  "AUT","BEL","BIH","CRO","CZE","ENG","FRA","GER","NED","NOR","POR","SCO","ESP","SWE","SUI","TUR",
  // AFC
  "AUS","IRN","IRQ","JPN","JOR","QAT","KSA","KOR","UZB",
  // CAF
  "ALG","CPV","COD","EGY","GHA","CIV","MAR","SEN","RSA","TUN",
  // CONCACAF
  "CAN","CUW","HAI","MEX","PAN","USA",
  // OFC
  "NZL",
];

function normaliseHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(h)) return null;
  return h;
}

// GET /api/fan-vote → { tallies: Record<string,number>, total: number }
export async function GET() {
  try {
    const keys = NATIONS.map(c => `fan:tally:${c}`);
    const values = await redis.mget<number[]>(...keys);
    const tallies: Record<string, number> = {};
    let total = 0;
    NATIONS.forEach((c, i) => {
      const v = Number(values[i] ?? 0);
      tallies[c] = v;
      total += v;
    });
    return NextResponse.json({ tallies, total });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/fan-vote — body: { country: string, xHandle: string }
export async function POST(req: NextRequest) {
  try {
    const { country, xHandle } = await req.json();

    if (!NATIONS.includes(country)) {
      return NextResponse.json({ error: "Invalid country" }, { status: 400 });
    }

    const handle = normaliseHandle(xHandle ?? "");
    if (!handle) {
      return NextResponse.json({ error: "Invalid X handle (1-15 chars, letters/numbers/_)" }, { status: 400 });
    }

    // Check if handle already voted (supports changing pick)
    const existingCountry = await redis.get<string>(`fan:handle:${handle}`);
    if (existingCountry) {
      // Allow changing pick: update tallies if country changed
      if (existingCountry !== country) {
        await Promise.all([
          redis.decr(`fan:tally:${existingCountry}`),
          redis.incr(`fan:tally:${country}`),
          redis.set(`fan:handle:${handle}`, country),
        ]);
      }
    } else {
      // New vote
      await Promise.all([
        redis.incr(`fan:tally:${country}`),
        redis.sadd("fan:voted", handle),
        redis.set(`fan:handle:${handle}`, country),
        redis.rpush("fan:entries", JSON.stringify({ country, xHandle: handle, ts: Date.now() })),
      ]);
    }

    const keys = NATIONS.map(c => `fan:tally:${c}`);
    const values = await redis.mget<number[]>(...keys);
    let total = 0;
    const tallies: Record<string, number> = {};
    NATIONS.forEach((c, i) => {
      const v = Number(values[i] ?? 0);
      tallies[c] = v;
      total += v;
    });

    return NextResponse.json({ success: true, tallies, total });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
