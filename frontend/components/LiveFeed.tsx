import { FeedEntry } from "@/lib/useAttestations";
import { COUNTRY_MAP } from "@/lib/countries";
import { REGIME_COLORS, REGIME_LABELS } from "./RegimeBadge";

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

interface Props {
  feed: FeedEntry[];
}

export function LiveFeed({ feed }: Props) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div className="pulse-dot" />
        <span
          style={{
            fontFamily: "var(--font-orbitron), sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "var(--text-primary)",
          }}
        >
          LIVE ATTESTATIONS
        </span>
      </div>

      {/* Entries */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {feed.length === 0 ? (
          <div style={{ padding: "24px 16px", color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
            Waiting for attestations…
          </div>
        ) : (
          feed.map((entry) => {
            const country = COUNTRY_MAP.get(entry.iso3);
            const accentColor = REGIME_COLORS[entry.regime];
            return (
              <div key={entry.id} className="feed-entry" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{country?.flag ?? "🏳"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-orbitron), sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        color: "var(--text-primary)",
                      }}
                    >
                      {entry.iso3}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-faint)",
                      }}
                    >
                      {relativeTime(entry.ts)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
                      {entry.score}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: accentColor,
                        border: `1px solid ${accentColor}`,
                        borderRadius: 2,
                        padding: "1px 4px",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {REGIME_LABELS[entry.regime]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
