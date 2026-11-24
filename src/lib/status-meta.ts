import type { Severity, Status } from "@/lib/ml/analysis";

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "var(--status-ok)" },
  watch: { label: "Watch", color: "var(--status-watch)" },
  "at-risk": { label: "At risk", color: "var(--status-risk)" },
  critical: { label: "Critical", color: "var(--status-critical)" },
};

export const SEVERITY_META: Record<Severity, { label: string; variant: "critical" | "at-risk" | "watch" }> = {
  critical: { label: "Critical", variant: "critical" },
  high: { label: "High", variant: "at-risk" },
  medium: { label: "Medium", variant: "watch" },
};

export const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export const chartAxisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
