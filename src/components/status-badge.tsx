import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/ml/analysis";
import { STATUS_META } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant={status} className={cn("gap-1.5 font-mono text-[0.68rem] uppercase tracking-wider", className)}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "critical" && "animate-signal")} />
      {STATUS_META[status].label}
    </Badge>
  );
}
