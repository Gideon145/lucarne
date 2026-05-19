import { NationData } from "@/lib/useAttestations";
import { COUNTRY_MAP } from "@/lib/countries";
import { RegimeBadge, REGIME_COLORS, REGIME_GLOWS } from "./RegimeBadge";
import { OKLINK_BASE, SIGNAL_ATTESTOR } from "@/lib/constants";

function scoreColor(score: number): string {
  if (score >= 75) return "var(--gold)";
  if (score >= 55) return "var(--amber)";
  if (score >= 30) return "var(--green)";
  return "var(--calm)";
}

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface Props {
  nation: NationData;
  onClick?: () => void;
}

export function NationCard({ nation, onClick }: Props) {
  const country = COUNTRY_MAP.get(nation.iso3);
  if (!country) return null;

  const { iso3, score, regime, ts, polybotOdds, signalHash } = nation;
  const accentColor  = REGIME_COLORS[regime];
  const glowColor    = REGIME_GLOWS[regime];
  const barColor     = scoreColor(score);
  const shortHash    = signalHash && signalHash !== "0x"
    ? `${signalHash.slice(0, 6)}…${signalHash.slice(-4)}`
    : null;

  const regimeClass = ["regime-calm", "regime-trending", "regime-volatile", "regime-breakout"][regime];

  return (
    <div
      className={`nation-card ${regimeClass}`}
      onClick={onClick}
      style={{ padding: "16px", cursor: onClick ? "pointer" : "default" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{country.flag}</span>
          <div>
            <div
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: "var(--text-primary)",
                letterSpacing: "0.05em",
              }}
            >
              {country.name}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              {iso3} · {country.confederation}
            </div>
          </div>
        </div>
        <RegimeBadge regime={regime} />
      </div>

      {/* Score */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color: accentColor,
              textShadow: `0 0 14px ${glowColor}`,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {score}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", alignSelf: "flex-end", paddingBottom: 3 }}>
            /100
          </span>
        </div>
        <div className="score-track">
          <div
            className="score-fill"
            style={{ width: `${score}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {polybotOdds !== null && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              <span style={{ color: accentColor, fontWeight: 700 }}>{polybotOdds}%</span>
              {" "}odds
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {relativeTime(ts)}
          </span>
        </div>

        {shortHash && (
          <a
            href={`${OKLINK_BASE}/address/${SIGNAL_ATTESTOR}`}
            target="_blank"
            rel="noreferrer"
            title={signalHash}
            style={{ fontSize: 10, color: "var(--text-dim)", textDecoration: "none" }}
          >
            ⛓ {shortHash}
          </a>
        )}
      </div>
    </div>
  );
}
