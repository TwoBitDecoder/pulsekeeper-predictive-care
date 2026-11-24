/** Model input features, in the fixed order the logistic regression uses. */
export const FEATURES = [
  { key: "avgTemperature", label: "Internal temperature", unit: "°C", min: 28, max: 48, step: 0.1 },
  { key: "tempTrend", label: "Temperature trend", unit: "°C/day", min: -0.1, max: 0.4, step: 0.01 },
  { key: "batteryHealth", label: "Battery health", unit: "%", min: 40, max: 100, step: 1 },
  { key: "operatingHoursK", label: "Operating hours", unit: "k hrs", min: 0, max: 60, step: 0.5 },
  { key: "daysSinceService", label: "Days since service", unit: "days", min: 0, max: 720, step: 5 },
  { key: "pastFailures", label: "Past failures", unit: "", min: 0, max: 8, step: 1 },
  { key: "errorRate", label: "Error events", unit: "/day", min: 0, max: 6, step: 0.1 },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export type FeatureVector = Record<FeatureKey, number>;

export const toVector = (f: FeatureVector) => FEATURES.map((d) => f[d.key]);

export const featureLabel = (key: FeatureKey) => FEATURES.find((f) => f.key === key)!.label;
