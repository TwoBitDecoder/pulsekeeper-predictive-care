import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, PageHeader, Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatNumber, pct } from "@/lib/format";
import { getFleetAnalysis, RISK_THRESHOLDS, scoreFeatures } from "@/lib/ml/analysis";
import { FEATURES, type FeatureVector } from "@/lib/ml/features";
import { chartAxisProps, chartTooltipStyle, STATUS_META } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "AI Model & Risk Simulator — PulseGuard" },
      { name: "description", content: "How the predictive-maintenance model works, its test accuracy, and a what-if simulator for equipment failure risk." },
      { property: "og:title", content: "AI Model & Risk Simulator — PulseGuard" },
      { property: "og:description", content: "Logistic-regression failure model with anomaly detection for hospital equipment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModelPage,
});

const PRESETS = {
  Healthy: { avgTemperature: 33.8, tempTrend: 0, batteryHealth: 92, operatingHoursK: 9, daysSinceService: 90, pastFailures: 0, errorRate: 0.3 },
  Degrading: { avgTemperature: 36.5, tempTrend: 0.06, batteryHealth: 78, operatingHoursK: 24, daysSinceService: 310, pastFailures: 1, errorRate: 1.2 },
  Failing: { avgTemperature: 40, tempTrend: 0.15, batteryHealth: 64, operatingHoursK: 38, daysSinceService: 480, pastFailures: 3, errorRate: 2.6 },
} satisfies Record<string, FeatureVector>;

const PIPELINE = [
  ["Collect", "Daily telemetry: internal temperature, battery health, error events, operating hours, plus maintenance records."],
  ["Engineer features", "7-day averages, 30-day temperature trend (least-squares slope), days since service, failure count."],
  ["Detect anomalies", "Each device's first 21 days form its baseline; later readings more than 3σ away are flagged as unusual."],
  ["Predict risk", "Logistic regression (standardised inputs, L2-regularised gradient descent) estimates P(failure in 30 days)."],
  ["Alert & plan", "Risk bands, battery limits and service intervals generate alerts and a predicted maintenance date."],
];

function ModelPage() {
  const { training } = getFleetAnalysis();
  const m = training.metrics;
  const [values, setValues] = useState<FeatureVector>(PRESETS.Degrading);
  const sim = scoreFeatures(training.model, values);
  const maxImp = training.featureImportance[0]?.importance ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI model"
        title="How failures are predicted"
        description={`Trained on ${formatNumber(training.trainSize)} historical equipment records and tested on ${formatNumber(training.testSize)} records it never saw. ${pct(training.positiveRate)} of records failed within 30 days.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Accuracy" value={pct(m.accuracy, 1)} />
        <Kpi label="Precision" value={pct(m.precision, 1)} hint="Flagged devices that truly failed" />
        <Kpi label="Recall" value={pct(m.recall, 1)} hint="Failures caught in advance" />
        <Kpi label="F1 score" value={m.f1.toFixed(3)} />
        <Kpi label="ROC AUC" value={m.auc.toFixed(3)} tone="ok" />
      </div>

      <Panel title="Pipeline">
        <ol className="grid gap-3 md:grid-cols-5">
          {PIPELINE.map(([t, body], i) => (
            <li key={t} className="rounded-md border bg-surface-raised p-3">
              <span className="font-mono text-xs text-primary">0{i + 1}</span>
              <p className="mt-1 text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="ROC curve · test set">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={training.roc} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} {...chartAxisProps} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => v.toFixed(2)} />
                <YAxis dataKey="tpr" domain={[0, 1]} {...chartAxisProps} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => v.toFixed(2)} labelFormatter={(v: number) => `FPR ${v.toFixed(2)}`} />
                <Line dataKey="tpr" name="TPR" stroke="var(--chart-1)" strokeWidth={2} dot={false} type="stepAfter" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Confusion matrix · threshold 0.5">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-center text-xs">
            <span />
            <span className="label-caps">Pred. OK</span>
            <span className="label-caps">Pred. fail</span>
            <span className="label-caps self-center pr-2 text-right">Actual OK</span>
            <Cell value={m.tn} good />
            <Cell value={m.fp} />
            <span className="label-caps self-center pr-2 text-right">Actual fail</span>
            <Cell value={m.fn} />
            <Cell value={m.tp} good />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Missed failures (bottom-left) are the costliest error in a hospital, so recall is tracked closely.</p>
        </Panel>

        <Panel title="Feature importance">
          <ul className="space-y-2.5">
            {training.featureImportance.map((f) => (
              <li key={f.key} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono">{pct(f.importance)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(f.importance / maxImp) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="What-if risk simulator"
        action={
          <div className="flex gap-1">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
              <Button key={k} size="sm" variant="secondary" onClick={() => setValues(PRESETS[k])}>
                {k}
              </Button>
            ))}
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {FEATURES.map((f) => (
              <label key={f.key} className="block">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono tabular">
                    {values[f.key].toFixed(f.step < 1 ? (f.step < 0.1 ? 2 : 1) : 0)} {f.unit}
                  </span>
                </div>
                <Slider min={f.min} max={f.max} step={f.step} value={[values[f.key]]} onValueChange={([v]) => setValues((s) => ({ ...s, [f.key]: v }))} />
              </label>
            ))}
          </div>
          <div className={cn("rounded-lg border bg-surface-raised p-5", sim.status === "critical" && "shadow-glow-critical")}>
            <p className="label-caps">Predicted failure risk</p>
            <p className="mt-2 font-mono text-5xl tabular" style={{ color: STATUS_META[sim.status].color }}>
              {pct(sim.risk)}
            </p>
            <StatusBadge status={sim.status} className="mt-3" />
            <p className="label-caps mt-5">Top risk factors</p>
            <ul className="mt-2 space-y-1 text-xs">
              {sim.drivers.slice(0, 3).map((d) => (
                <li key={d.key} className="flex justify-between">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-mono">{d.contribution >= 0 ? "+" : ""}{d.contribution.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.7rem] text-muted-foreground">
              Bands: Watch ≥ {pct(RISK_THRESHOLDS.watch)}, At risk ≥ {pct(RISK_THRESHOLDS.atRisk)}, Critical ≥ {pct(RISK_THRESHOLDS.critical)}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Cell({ value, good }: { value: number; good?: boolean }) {
  return (
    <div className={cn("rounded-md border py-5 font-mono text-2xl tabular", good ? "border-status-ok/30 bg-status-ok/10 text-status-ok" : "border-status-critical/30 bg-status-critical/10 text-status-critical")}>
      {value}
    </div>
  );
}
