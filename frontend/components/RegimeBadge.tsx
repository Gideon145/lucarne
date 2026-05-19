import { Regime } from "@/lib/useAttestations";

export const REGIME_LABELS = ["CALM", "TRENDING", "VOLATILE", "BREAKOUT"] as const;

export const REGIME_COLORS: Record<Regime, string> = {
  0: "var(--calm)",
  1: "var(--green)",
  2: "var(--amber)",
  3: "var(--gold)",
};

export const REGIME_GLOWS: Record<Regime, string> = {
  0: "var(--calm-glow)",
  1: "var(--green-glow)",
  2: "var(--amber-glow)",
  3: "var(--gold-glow)",
};

interface Props {
  regime: Regime;
  size?: "sm" | "md";
}

export function RegimeBadge({ regime, size = "sm" }: Props) {
  const color = REGIME_COLORS[regime];
  const label = REGIME_LABELS[regime];

  return (
    <span
      className="badge"
      style={{
        color,
        borderColor: color,
        fontSize: size === "md" ? 11 : 9,
        padding: size === "md" ? "3px 8px" : "2px 6px",
      }}
    >
      {label}
    </span>
  );
}
