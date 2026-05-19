"use client";

import { useMemo, useState } from "react";
import { useAttestations } from "@/lib/useAttestations";
import { NationCard } from "@/components/NationCard";
import { LiveFeed } from "@/components/LiveFeed";
import { REGIME_COLORS } from "@/components/RegimeBadge";
import { OKLINK_BASE, SIGNAL_ATTESTOR, AGENT_WALLET } from "@/lib/constants";
import type { Regime } from "@/lib/useAttestations";

const REGIME_FILTERS = ["ALL", "BREAKOUT", "VOLATILE", "TRENDING", "CALM"] as const;
type FilterType = typeof REGIME_FILTERS[number];

const REGIME_INDEX: Record<FilterType, Regime | null> = {
  ALL: null, BREAKOUT: 3, VOLATILE: 2, TRENDING: 1, CALM: 0,
};

export default function Home() {
  const { nations, totalAttestations, feed, loading, lastRefresh, agentLive, polybotLive } =
    useAttestations();
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [sort, setSort] = useState<"score" | "regime" | "recent">("score");

  const filtered = useMemo(() => {
    const regimeIdx = REGIME_INDEX[filter];
    let list = regimeIdx !== null
      ? nations.filter((n) => n.regime === regimeIdx)
      : [...nations];

    if (sort === "score")  list.sort((a, b) => b.score - a.score);
    if (sort === "recent") list.sort((a, b) => b.ts - a.ts);
    if (sort === "regime") list.sort((a, b) => b.regime - a.regime || b.score - a.score);
    return list;
  }, [nations, filter, sort]);

  const breakoutCount  = nations.filter((n) => n.regime === 3).length;
  const volatileCount  = nations.filter((n) => n.regime === 2).length;
  const trendingCount  = nations.filter((n) => n.regime === 1).length;
  const topNation      = nations.length ? nations.reduce((a, b) => b.score > a.score ? b : a, nations[0]) : null;

  const lastRefreshStr = lastRefresh
    ? new Date(lastRefresh).toLocaleTimeString()
    : "--";

  return (
    <div className="hud-grid" style={{ minHeight: "100vh" }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(6,15,9,0.95)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "var(--green)",
              textShadow: "0 0 20px var(--green-glow)",
            }}
          >
            LUCARNE
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
            World Cup Signal Intelligence
          </span>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <StatusPill label="AGENT" live={agentLive} />
          <StatusPill label="POLYBOT" live={polybotLive} />
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Updated {lastRefreshStr}
          </div>
        </div>
      </header>

      {/* ── Stats Banner ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 32,
          alignItems: "center",
          overflowX: "auto",
        }}
      >
        <StatItem label="TOTAL ATTESTATIONS" value={totalAttestations.toLocaleString()} color="var(--green)" />
        <StatItem label="BREAKOUT" value={breakoutCount.toString()} color="var(--gold)" />
        <StatItem label="VOLATILE" value={volatileCount.toString()} color="var(--amber)" />
        <StatItem label="TRENDING" value={trendingCount.toString()} color="var(--green)" />
        {topNation && (
          <StatItem label="TOP SIGNAL" value={`${topNation.iso3} ${topNation.score}`} color={REGIME_COLORS[topNation.regime]} />
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, flexShrink: 0 }}>
          <a
            href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 10, color: "var(--text-dim)", textDecoration: "none" }}
          >
            ⛓ {SIGNAL_ATTESTOR.slice(0, 8)}…
          </a>
          <a
            href={`${OKLINK_BASE}/address/${AGENT_WALLET}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 10, color: "var(--text-dim)", textDecoration: "none" }}
          >
            🤖 {AGENT_WALLET.slice(0, 8)}…
          </a>
        </div>
      </div>

      {/* ── Filter + Sort ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {REGIME_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-tab${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["score", "regime", "recent"] as const).map((s) => (
            <button
              key={s}
              className={`filter-tab${sort === s ? " active" : ""}`}
              onClick={() => setSort(s)}
            >
              ↕ {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content: Grid + Feed ─────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 0,
          maxWidth: 1400,
          margin: "0 auto",
          width: "100%",
          padding: "0",
        }}
      >
        {/* Nation Grid */}
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          {loading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No nations in {filter} regime right now.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((nation) => (
                <NationCard key={nation.iso3} nation={nation} />
              ))}
            </div>
          )}
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              fontSize: 10,
              color: "var(--text-faint)",
              textAlign: "center",
            }}
          >
            LUCARNE · OKX X Layer Build-X · Signal-gated attestations every 60s
          </div>
        </div>

        {/* Live Feed Sidebar */}
        <div style={{ padding: "20px 16px", height: "calc(100vh - 160px)", position: "sticky", top: 160 }}>
          <LiveFeed feed={feed} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ label, live }: { label: string; live: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        border: `1px solid ${live ? "var(--green)" : "var(--border)"}`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: live ? "var(--green)" : "var(--text-dim)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: live ? "var(--green)" : "var(--text-faint)",
          boxShadow: live ? "0 0 5px var(--green)" : "none",
        }}
      />
      {label}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          fontSize: 18,
          fontWeight: 800,
          color,
          textShadow: `0 0 10px ${color}44`,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 140,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

