import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// GET /api/fan-vote/draw?secret=YOUR_SECRET
// Returns all entries + randomly selected winner. Keep the secret in DRAW_SECRET env var.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.DRAW_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const raw = await kv.lrange<string>("fan:entries", 0, -1);
    const entries = raw.map(e => (typeof e === "string" ? JSON.parse(e) : e));

    if (entries.length === 0) {
      return NextResponse.json({ error: "No entries yet" }, { status: 404 });
    }

    const winner = entries[Math.floor(Math.random() * entries.length)];
    return NextResponse.json({ winner, totalEntries: entries.length, entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
