import { CATEGORIES, type Category, type FindingStatus, type Severity } from "@shared/types";

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#38bdf8",
  medium: "#facc15",
  high: "#f97316",
  critical: "#dc2626",
};
export const REPAIRED_COLOR = "#22c55e";

export const severityClass: Record<Severity, string> = {
  low: "bg-sev-low",
  medium: "bg-sev-medium",
  high: "bg-sev-high",
  critical: "bg-sev-critical",
};

export const statusLabel: Record<FindingStatus, string> = { open: "Open", monitoring: "Monitoring", repaired: "Repaired" };
export const severityLabel: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
export const categoryLabel = (c: Category | string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
