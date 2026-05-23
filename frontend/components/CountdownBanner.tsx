"use client";

import { useEffect, useState } from "react";

// World Cup 2026 opening match: June 11 2026 8:00 PM ET = June 12 2026 00:00 UTC
const WC_KICKOFF = new Date("2026-06-12T00:00:00Z").getTime();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownBanner() {
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setDiff(Math.max(0, WC_KICKOFF - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (diff === null) return null;

  const kicked = diff === 0;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);

  return (
    <div
      style={{
        background: "linear-gradient(90deg, rgba(0,255,136,0.08) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,255,136,0.08) 100%)",
        borderBottom: "1px solid rgba(0,255,136,0.18)",
        padding: "7px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontSize: 11,
        letterSpacing: "0.14em",
        fontFamily: "var(--font-mono, monospace)",
        color: "var(--text-dim, #9ca3af)",
      }}
    >
      <span style={{ fontSize: 15 }}>⚽</span>

      {kicked ? (
        <span style={{ color: "var(--green, #00ff88)", fontWeight: 700 }}>
          FIFA WORLD CUP 2026 IS LIVE
        </span>
      ) : (
        <>
          <span>FIFA WORLD CUP 2026 KICKOFF IN</span>
          <span
            style={{
              fontFamily: "var(--font-orbitron, sans-serif)",
              fontWeight: 900,
              fontSize: 13,
              color: "var(--green, #00ff88)",
              textShadow: "0 0 10px rgba(0,255,136,0.4)",
            }}
          >
            {d}d {pad(h)}h {pad(m)}m {pad(s)}s
          </span>
        </>
      )}

      <span style={{ fontSize: 15 }}>⚽</span>
    </div>
  );
}
