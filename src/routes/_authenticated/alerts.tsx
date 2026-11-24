import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { getFleetAnalysis, type Severity } from "@/lib/ml/analysis";
import { SEVERITY_META } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pulseguard:acknowledged-alerts";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Maintenance Alerts — PulseGuard" },
      { name: "description", content: "AI-generated maintenance alerts for hospital equipment: failure risk, unusual readings, battery and overdue service." },
      { property: "og:title", content: "Maintenance Alerts — PulseGuard" },
      { property: "og:description", content: "Prioritised maintenance alerts for infusion pumps and patient monitors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { alerts } = getFleetAnalysis();
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [showAcked, setShowAcked] = useState(false);
  const [acked, setAcked] = useState<string[]>([]);

  useEffect(() => {
    try {
      setAcked(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      setAcked([]);
    }
  }, []);

  const toggle = (id: string) => {
    setAcked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const open = alerts.filter((a) => !acked.includes(a.id));
  const visible = alerts.filter((a) => (filter === "all" || a.severity === filter) && (showAcked || !acked.includes(a.id)));
  const count = (s: Severity) => open.filter((a) => a.severity === s).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Alerts" title={`${open.length} open maintenance alerts`} description="Generated from the failure-risk model, unusual-pattern detection, battery limits and service intervals.">
        <Button variant="outline" size="sm" onClick={() => setShowAcked((v) => !v)}>
          {showAcked ? "Hide acknowledged" : `Show acknowledged (${acked.length})`}
        </Button>
      </PageHeader>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | Severity)}>
        <TabsList>
          <TabsTrigger value="all">All ({open.length})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({count("critical")})</TabsTrigger>
          <TabsTrigger value="high">High ({count("high")})</TabsTrigger>
          <TabsTrigger value="medium">Medium ({count("medium")})</TabsTrigger>
        </TabsList>
      </Tabs>

      <ul className="space-y-2">
        {visible.map((a) => {
          const isAcked = acked.includes(a.id);
          return (
            <li key={a.id} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center", isAcked && "opacity-50")}>
              <div className="flex shrink-0 items-center gap-2 md:w-40 md:flex-col md:items-start">
                <Badge variant={SEVERITY_META[a.severity].variant} className="font-mono text-[0.62rem] uppercase">
                  {SEVERITY_META[a.severity].label}
                </Badge>
                <span className="label-caps">{a.category}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Link to="/equipment/$id" params={{ id: a.equipmentId }} className="text-primary hover:underline">
                    {a.equipmentLabel}
                  </Link>{" "}
                  · {a.ward} · {formatDate(a.date)}
                </p>
              </div>
              <Button variant={isAcked ? "ghost" : "secondary"} size="sm" onClick={() => toggle(a.id)} className="self-start md:self-center">
                {isAcked ? (
                  <>
                    <RotateCcw /> Reopen
                  </>
                ) : (
                  <>
                    <Check /> Acknowledge
                  </>
                )}
              </Button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No alerts in this view.</li>}
      </ul>
    </div>
  );
}
