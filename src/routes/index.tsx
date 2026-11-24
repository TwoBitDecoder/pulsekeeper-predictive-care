import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, PageHeader, Panel } from "@/components/panel";
import { RiskMeter } from "@/components/risk-meter";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AS_OF_ISO, formatDate, formatShortDate, pct } from "@/lib/format";
import { getFleetAnalysis, statusFromRisk, STATUS_ORDER } from "@/lib/ml/analysis";
import { WARDS } from "@/lib/ml/fleet";
import { chartAxisProps, chartTooltipStyle, SEVERITY_META, STATUS_META } from "@/lib/status-meta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleet Overview — PulseGuard Predictive Maintenance" },
      { name: "description", content: "Live AI risk overview of hospital infusion pumps and patient monitors, with maintenance alerts and forecasts." },
      { property: "og:title", content: "Fleet Overview — PulseGuard" },
      { property: "og:description", content: "See which hospital equipment needs maintenance before it fails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { devices, alerts, summary } = getFleetAnalysis();
  const needAttention = summary.byStatus.critical + summary.byStatus["at-risk"];

  const histogram = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i * 10 + 10}%`,
    count: devices.filter((d) => Math.min(Math.floor(d.risk * 10), 9) === i).length,
    color: STATUS_META[statusFromRisk(i / 10 + 0.05)].color,
  }));

  const wardData = WARDS.map((ward) => {
    const inWard = devices.filter((d) => d.ward === ward);
    return { ward, ...Object.fromEntries(STATUS_ORDER.map((s) => [s, inWard.filter((d) => d.status === s).length])) };
  });

  const forecast = Array.from({ length: 8 }, (_, w) => ({
    week: `W${w + 1}`,
    count: devices.filter((d) => d.forecast.days >= w * 7 && d.forecast.days < (w + 1) * 7).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Fleet status · ${formatDate(AS_OF_ISO)}`}
        title={
          <>
            {needAttention} of {summary.total} devices need attention
          </>
        }
        description="Machine-learning risk scores from temperature, battery health, operating hours, error events and maintenance history."
      >
        <Button asChild>
          <Link to="/equipment">
            View all equipment <ArrowRight />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Monitored devices" value={summary.total} hint="Infusion pumps & patient monitors" />
        <Kpi label="Critical" value={summary.byStatus.critical} tone="critical" hint="≥ 80% failure risk" />
        <Kpi label="At risk" value={summary.byStatus["at-risk"]} tone="risk" hint="55–80% failure risk" />
        <Kpi label="Due ≤ 14 days" value={summary.dueWithin14} tone="risk" hint="Predicted maintenance window" />
        <Kpi label="Fleet health" value={pct(summary.fleetHealth)} tone="ok" hint={`${summary.anomalies} unusual readings detected`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Priority inspection queue" className="lg:col-span-2" action={<Link to="/equipment" className="text-xs text-primary hover:underline">All equipment</Link>}>
          <ul className="divide-y">
            {devices.slice(0, 7).map((d) => (
              <li key={d.id}>
                <Link to="/equipment/$id" params={{ id: d.id }} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_6.5rem]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="font-mono text-primary">{d.id}</span> · {d.model}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.type} · {d.ward} · {d.drivers[0]?.label}
                    </p>
                  </div>
                  <RiskMeter risk={d.risk} status={d.status} className="hidden md:flex" />
                  <p className="hidden text-right font-mono text-xs text-muted-foreground md:block">{d.forecast.days === 0 ? "Now" : `${d.forecast.days} days`}</p>
                  <div className="justify-self-end">
                    <StatusBadge status={d.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Latest alerts" action={<Link to="/alerts" className="text-xs text-primary hover:underline">{alerts.length} total</Link>}>
          <ul className="space-y-3">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id} className="rounded-md border bg-surface-raised p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={SEVERITY_META[a.severity].variant} className="font-mono text-[0.62rem] uppercase">
                    {SEVERITY_META[a.severity].label}
                  </Badge>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">{formatShortDate(a.date)}</span>
                </div>
                <p className="mt-2 text-sm font-medium">{a.title}</p>
                <Link to="/equipment/$id" params={{ id: a.equipmentId }} className="text-xs text-muted-foreground hover:text-primary">
                  {a.equipmentLabel} · {a.ward}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Failure-risk distribution">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={histogram} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="range" {...chartAxisProps} interval={1} />
                <YAxis allowDecimals={false} {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" name="Devices" radius={[3, 3, 0, 0]}>
                  {histogram.map((h) => (
                    <Cell key={h.range} fill={h.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Status by ward">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={wardData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" allowDecimals={false} {...chartAxisProps} />
                <YAxis type="category" dataKey="ward" width={84} {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                {[...STATUS_ORDER].reverse().map((s) => (
                  <Bar key={s} dataKey={s} name={STATUS_META[s].label} stackId="a" fill={STATUS_META[s].color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Maintenance forecast · next 8 weeks">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={forecast} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" {...chartAxisProps} />
                <YAxis allowDecimals={false} {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" name="Devices due" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
