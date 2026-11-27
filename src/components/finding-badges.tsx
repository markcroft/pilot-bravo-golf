import type { FindingStatus, Severity } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { severityClass, severityLabel, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", severityClass[severity], className)} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <SeverityDot severity={severity} />
      {severityLabel[severity]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: FindingStatus }) {
  const cls =
    status === "repaired"
      ? "border-transparent bg-green-600/15 text-green-700 dark:text-green-400"
      : status === "monitoring"
        ? "border-transparent bg-sky-600/15 text-sky-700 dark:text-sky-400"
        : "border-transparent bg-orange-600/15 text-orange-700 dark:text-orange-400";
  return <Badge variant="outline" className={cls}>{statusLabel[status]}</Badge>;
}
