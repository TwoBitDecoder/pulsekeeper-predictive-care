import type { Status } from "@/lib/ml/analysis";
import { STATUS_META } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

export function RiskMeter({ risk, status, className }: { risk: number; status: Status; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.max(risk * 100, 2)}%`, background: STATUS_META[status].color }} />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular">{Math.round(risk * 100)}%</span>
    </div>
  );
}
