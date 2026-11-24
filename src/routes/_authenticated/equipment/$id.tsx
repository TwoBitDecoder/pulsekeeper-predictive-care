import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Wrench } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDays, AS_OF_ISO, formatDate, formatNumber, formatShortDate, pct } from "@/lib/format";
import { getDevice, LIMITS } from "@/lib/ml/analysis";
import { chartAxisProps, chartTooltipStyle, STATUS_META } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/equipment/$id")({
  loader: ({ params }) => {
    const d = getDevice(params.id);
    if (!d) throw notFound();
    return { id: d.id, model: d.model, type: d.type, ward: d.ward };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.id} ${loaderData.model} — PulseGuard` : "Equipment — PulseGuard";
    const description = loaderData
      ? `Failure risk, sensor readings and maintenance history for ${loaderData.type.toLowerCase()} ${loaderData.id} in ${loaderData.ward}.`
      : "Equipment detail";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold">Equipment not found</p>
      <Link to="/equipment" className="mt-3 inline-block text-sm text-primary hover:underline">
        Back to equipment
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <p className="py-20 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Something went wrong"}</p>,
  component: EquipmentDetail,
});

function EquipmentDetail() {
  const { id } = Route.useParams();
  const d = getDevice(id)!;
  const meta = STATUS_META[d.status];
  const anomalyDates = new Set(d.anomalies.filter((a) => a.metric === "temperature").map((a) => a.date));
  const chartData = d.telemetry.map((p) => ({ ...p, label: formatShortDate(p.date) }));
  const maxContribution = Math.max(...d.drivers.map((x) => Math.abs(x.contribution)), 0.01);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
        <Link to="/equipment">
          <ArrowLeft /> Equipment
        </Link>
      </Button>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-primary">{d.id}</span>
            <StatusBadge status={d.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{d.model}</h1>
          <p className="text-sm text-muted-foreground">
            {d.type} · {d.manufacturer} · {d.ward}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Temperature (7d)", `${d.features.avgTemperature.toFixed(1)}°C`],
              ["Battery health", `${d.features.batteryHealth.toFixed(0)}%`],
              ["Operating hours", formatNumber(d.operatingHours)],
              ["Last service", `${d.daysSinceService} days ago`],
              ["Errors / day (7d)", d.features.errorRate.toFixed(1)],
              ["Past failures", d.pastFailures],
              ["Serial", d.serial],
              ["In service since", formatDate(d.installDate)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="label-caps">{k}</dt>
                <dd className="mt-1 font-mono text-sm tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={cn("flex flex-col rounded-lg border bg-card p-5", d.status === "critical" && "shadow-glow-critical")}>
          <p className="label-caps">Failure risk · next 30 days</p>
          <p className="mt-2 font-mono text-6xl font-medium tabular" style={{ color: meta.color }}>
            {pct(d.risk)}
          </p>
          <div className="mt-4 space-y-3 border-t pt-4 text-sm">
            <p className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">
                  {d.forecast.days === 0 ? "Maintenance needed now" : `Maintenance in ~${d.forecast.days}${d.forecast.days === 180 ? "+" : ""} days`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.forecast.driver} · by {formatDate(addDays(AS_OF_ISO, d.forecast.days))}
                </span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Wrench className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{d.recommendation}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Internal temperature · 30 days" action={anomalyDates.size > 0 && <Badge variant="critical" className="font-mono text-[0.62rem]">{anomalyDates.size} anomal{anomalyDates.size === 1 ? "y" : "ies"}</Badge>}>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...chartAxisProps} interval={6} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} {...chartAxisProps} tickFormatter={(v: number) => v.toFixed(0)} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <ReferenceLine y={LIMITS.maxTemperature} stroke="var(--status-critical)" strokeDasharray="4 4" label={{ value: "Limit", fill: "var(--status-critical)", fontSize: 10, position: "insideTopRight" }} />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="°C"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={(props: { cx?: number; cy?: number; index?: number; payload?: { date: string } }) =>
                    anomalyDates.has(props.payload?.date ?? "") ? (
                      <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill="var(--status-critical)" stroke="var(--card)" strokeWidth={2} />
                    ) : (
                      <circle key={props.index} cx={props.cx} cy={props.cy} r={0} />
                    )
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Battery health · 30 days">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="batt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...chartAxisProps} interval={6} />
                <YAxis domain={[(min: number) => Math.min(Math.floor(min - 5), 65), 100]} {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <ReferenceLine y={LIMITS.batteryReplace} stroke="var(--status-risk)" strokeDasharray="4 4" label={{ value: "Replace", fill: "var(--status-risk)", fontSize: 10, position: "insideBottomRight" }} />
                <Area type="monotone" dataKey="batteryHealth" name="Battery %" stroke="var(--chart-2)" strokeWidth={2} fill="url(#batt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Error events per day">
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: -24, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...chartAxisProps} interval={6} />
                <YAxis allowDecimals={false} {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="errorCount" name="Errors" fill="var(--chart-3)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Why the model flagged this device">
          <ul className="space-y-2.5">
            {d.drivers.map((x) => (
              <li key={x.key} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-xs">
                <span className="truncate text-muted-foreground">{x.label}</span>
                <div className="relative h-2 rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <div
                    className={cn("absolute inset-y-0 rounded-full", x.contribution >= 0 ? "left-1/2 bg-status-critical" : "right-1/2 bg-status-ok")}
                    style={{ width: `${(Math.abs(x.contribution) / maxContribution) * 50}%` }}
                  />
                </div>
                <span className="text-right font-mono tabular">{x.contribution >= 0 ? "+" : ""}{x.contribution.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Red bars push risk up, green bars pull it down (log-odds contribution). Fleet deviation score: <span className="font-mono text-foreground">{d.fleetDeviation.toFixed(2)}σ</span> vs other {d.type.toLowerCase()}s.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Unusual patterns detected">
          {d.anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unusual readings in the last 9 days compared with this device's own baseline.</p>
          ) : (
            <ul className="space-y-2">
              {d.anomalies.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-md border bg-surface-raised p-3 text-sm">
                  <span>{a.message}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatShortDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Maintenance history">
          <ol className="relative space-y-4 border-l pl-5">
            {d.maintenance.map((m, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute -left-[1.6rem] top-1 size-2.5 rounded-full border-2 border-card", m.type === "Corrective" ? "bg-status-critical" : "bg-primary")} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{m.type}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatDate(m.date)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.note} · {m.technician}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
