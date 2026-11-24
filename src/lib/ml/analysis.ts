import { AS_OF_ISO, pct } from "@/lib/format";
import { FEATURES, featureLabel, toVector, type FeatureKey, type FeatureVector } from "./features";
import { generateFleet, type Equipment, type TelemetryPoint } from "./fleet";
import { featureContributions, predictProbability, type LogisticModel } from "./model";
import { linearFit, mean, std } from "./stats";
import { trainFailureModel } from "./training";

export type Status = "healthy" | "watch" | "at-risk" | "critical";

/** Risk thresholds on P(failure within 30 days). */
export const RISK_THRESHOLDS = { watch: 0.3, atRisk: 0.55, critical: 0.8 } as const;

export function statusFromRisk(p: number): Status {
  if (p >= RISK_THRESHOLDS.critical) return "critical";
  if (p >= RISK_THRESHOLDS.atRisk) return "at-risk";
  if (p >= RISK_THRESHOLDS.watch) return "watch";
  return "healthy";
}

export const STATUS_ORDER: Status[] = ["critical", "at-risk", "watch", "healthy"];

export const LIMITS = { batteryReplace: 70, maxTemperature: 42, serviceIntervalDays: 365 } as const;

export interface Anomaly {
  date: string;
  metric: "temperature" | "errors" | "battery";
  zScore: number;
  message: string;
}

/**
 * Unusual-pattern detection: fit a baseline on the first 21 days, then flag later
 * readings whose residual is > 3σ from that baseline (temperature is detrended, so slow
 * drift is left to the trend feature and only sudden spikes are flagged).
 */
export function detectAnomalies(t: TelemetryPoint[]): Anomaly[] {
  const baseline = t.slice(0, 21);
  const temps = baseline.map((p) => p.temperature);
  const fit = linearFit(temps);
  const residualSd = Math.max(std(temps.map((v, i) => v - (fit.intercept + fit.slope * i))), 0.3);
  const errMean = mean(baseline.map((p) => p.errorCount));
  const errSd = Math.max(std(baseline.map((p) => p.errorCount)), 0.7);

  const out: Anomaly[] = [];
  for (let i = 21; i < t.length; i++) {
    const p = t[i]!;
    const tz = (p.temperature - (fit.intercept + fit.slope * i)) / residualSd;
    if (tz > 3) out.push({ date: p.date, metric: "temperature", zScore: tz, message: `Temperature ${p.temperature}°C is ${tz.toFixed(1)}σ above its baseline` });
    const ez = (p.errorCount - errMean) / errSd;
    if (ez > 3 && p.errorCount >= 3) out.push({ date: p.date, metric: "errors", zScore: ez, message: `${p.errorCount} error events logged (${ez.toFixed(1)}σ above normal)` });
    const drop = t[i - 1]!.batteryHealth - p.batteryHealth;
    if (drop > 2.5) out.push({ date: p.date, metric: "battery", zScore: drop, message: `Battery health dropped ${drop.toFixed(1)} points in one day` });
  }
  return out;
}

export function extractFeatures(e: Equipment): FeatureVector {
  const last7 = e.telemetry.slice(-7);
  return {
    avgTemperature: mean(last7.map((p) => p.temperature)),
    tempTrend: linearFit(e.telemetry.map((p) => p.temperature)).slope,
    batteryHealth: e.telemetry.at(-1)!.batteryHealth,
    operatingHoursK: e.operatingHours / 1000,
    daysSinceService: e.daysSinceService,
    pastFailures: e.pastFailures,
    errorRate: mean(last7.map((p) => p.errorCount)),
  };
}

export interface MaintenanceForecast {
  days: number;
  driver: string;
}

export function forecastMaintenance(e: Equipment, f: FeatureVector, risk: number): MaintenanceForecast {
  const candidates: MaintenanceForecast[] = [];
  const battSlope = linearFit(e.telemetry.map((p) => p.batteryHealth)).slope;
  if (f.batteryHealth <= LIMITS.batteryReplace) candidates.push({ days: 0, driver: "Battery below replacement level" });
  else if (battSlope < -0.01) candidates.push({ days: (f.batteryHealth - LIMITS.batteryReplace) / -battSlope, driver: "Battery reaches replacement level" });
  if (f.tempTrend > 0.01) candidates.push({ days: Math.max(0, (LIMITS.maxTemperature - f.avgTemperature) / f.tempTrend), driver: "Temperature reaches safe limit" });
  candidates.push({ days: Math.max(0, LIMITS.serviceIntervalDays - f.daysSinceService), driver: f.daysSinceService >= LIMITS.serviceIntervalDays ? "Preventive service overdue" : "Preventive service due" });
  const status = statusFromRisk(risk);
  if (status === "critical") candidates.push({ days: 3, driver: "High predicted failure risk" });
  else if (status === "at-risk") candidates.push({ days: 14, driver: "Elevated predicted failure risk" });
  const best = candidates.reduce((a, b) => (b.days < a.days ? b : a));
  return { days: Math.round(Math.min(best.days, 180)), driver: best.driver };
}

const RECOMMENDATIONS: Record<FeatureKey, string> = {
  avgTemperature: "Inspect cooling path, fans and power board for thermal stress.",
  tempTrend: "Rising temperature trend — check ventilation and internal power components.",
  batteryHealth: "Replace the battery pack and run a full charge-cycle test.",
  operatingHoursK: "High usage — inspect wear parts (motor, pump mechanism, connectors).",
  daysSinceService: "Perform overdue preventive maintenance and calibration.",
  pastFailures: "Repeated fault history — consider refurbishment or replacement.",
  errorRate: "Download the event log and investigate recurring error codes and alarms.",
};

export interface Driver {
  key: FeatureKey;
  label: string;
  contribution: number;
}

export interface DeviceAnalysis extends Equipment {
  features: FeatureVector;
  risk: number;
  status: Status;
  drivers: Driver[];
  anomalies: Anomaly[];
  fleetDeviation: number;
  forecast: MaintenanceForecast;
  recommendation: string;
}

export type Severity = "critical" | "high" | "medium";

export interface Alert {
  id: string;
  equipmentId: string;
  equipmentLabel: string;
  ward: string;
  severity: Severity;
  category: "Failure risk" | "Anomaly" | "Battery" | "Service";
  title: string;
  detail: string;
  date: string;
}

export function scoreFeatures(model: LogisticModel, f: FeatureVector) {
  const x = toVector(f);
  // Clamp so the dashboard never claims 0% or 100% certainty.
  const risk = Math.min(0.99, Math.max(0.01, predictProbability(model, x)));
  const contributions = featureContributions(model, x);
  const drivers: Driver[] = FEATURES.map((d, j) => ({ key: d.key, label: d.label, contribution: contributions[j]! })).sort(
    (a, b) => b.contribution - a.contribution,
  );
  return { risk, status: statusFromRisk(risk), drivers };
}

function buildAlerts(d: DeviceAnalysis): Alert[] {
  const label = `${d.id} · ${d.model}`;
  const base = { equipmentId: d.id, equipmentLabel: label, ward: d.ward };
  const alerts: Alert[] = [];
  if (d.status === "critical" || d.status === "at-risk") {
    alerts.push({
      ...base,
      id: `${d.id}-risk`,
      severity: d.status === "critical" ? "critical" : "high",
      category: "Failure risk",
      title: `${pct(d.risk)} predicted failure risk`,
      detail: `Main factor: ${d.drivers[0]!.label.toLowerCase()}. ${d.recommendation}`,
      date: AS_OF_ISO,
    });
  }
  d.anomalies.forEach((a, i) =>
    alerts.push({ ...base, id: `${d.id}-anom-${i}`, severity: "medium", category: "Anomaly", title: `Unusual ${a.metric} reading`, detail: a.message, date: a.date }),
  );
  if (d.features.batteryHealth <= LIMITS.batteryReplace) {
    alerts.push({ ...base, id: `${d.id}-batt`, severity: "high", category: "Battery", title: `Battery health ${d.features.batteryHealth.toFixed(0)}%`, detail: "Below the 70% replacement level — replace battery pack.", date: AS_OF_ISO });
  }
  if (d.daysSinceService > LIMITS.serviceIntervalDays) {
    alerts.push({ ...base, id: `${d.id}-svc`, severity: "medium", category: "Service", title: "Preventive service overdue", detail: `Last serviced ${d.daysSinceService} days ago (interval ${LIMITS.serviceIntervalDays} days).`, date: AS_OF_ISO });
  }
  return alerts;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

function analyse() {
  const training = trainFailureModel();
  const fleet = generateFleet();
  const featureSets = fleet.map(extractFeatures);

  const devices: DeviceAnalysis[] = fleet.map((e, i) => {
    const features = featureSets[i]!;
    const peers = featureSets.filter((_, j) => fleet[j]!.type === e.type);
    const zs = FEATURES.map((fd) => {
      const vals = peers.map((p) => p[fd.key]);
      return (features[fd.key] - mean(vals)) / (std(vals) || 1);
    });
    const { risk, status, drivers } = scoreFeatures(training.model, features);
    return {
      ...e,
      features,
      risk,
      status,
      drivers,
      anomalies: detectAnomalies(e.telemetry),
      fleetDeviation: Math.sqrt(mean(zs.map((z) => z * z))),
      forecast: forecastMaintenance(e, features, risk),
      recommendation: status === "healthy" ? "No action needed — continue routine monitoring." : RECOMMENDATIONS[drivers[0]!.key],
    };
  });

  const alerts = devices
    .flatMap(buildAlerts)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.date.localeCompare(a.date));

  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, devices.filter((d) => d.status === s).length])) as Record<Status, number>;

  return {
    training,
    devices: [...devices].sort((a, b) => b.risk - a.risk),
    alerts,
    summary: {
      total: devices.length,
      byStatus,
      fleetHealth: 1 - mean(devices.map((d) => d.risk)),
      dueWithin14: devices.filter((d) => d.forecast.days <= 14).length,
      anomalies: devices.reduce((n, d) => n + d.anomalies.length, 0),
    },
  };
}

let cache: ReturnType<typeof analyse> | null = null;

export function getFleetAnalysis() {
  cache ??= analyse();
  return cache;
}

export const getDevice = (id: string) => getFleetAnalysis().devices.find((d) => d.id === id);

export { featureLabel };
