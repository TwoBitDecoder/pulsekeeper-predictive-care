import { describe, expect, it } from "vitest";
import { detectAnomalies, getFleetAnalysis, scoreFeatures, statusFromRisk } from "@/lib/ml/analysis";
import type { TelemetryPoint } from "@/lib/ml/fleet";

describe("risk status bands", () => {
  it("maps failure probability to status", () => {
    expect(statusFromRisk(0.29)).toBe("healthy");
    expect(statusFromRisk(0.3)).toBe("watch");
    expect(statusFromRisk(0.55)).toBe("at-risk");
    expect(statusFromRisk(0.8)).toBe("critical");
  });
});

describe("failure model", () => {
  const { training } = getFleetAnalysis();

  it("separates failures on held-out test data", () => {
    expect(training.metrics.auc).toBeGreaterThan(0.9);
    expect(training.metrics.recall).toBeGreaterThan(0.75);
  });

  it("scores a worn device higher than a healthy one", () => {
    const healthy = scoreFeatures(training.model, { avgTemperature: 33.8, tempTrend: 0, batteryHealth: 92, operatingHoursK: 9, daysSinceService: 90, pastFailures: 0, errorRate: 0.3 });
    const worn = scoreFeatures(training.model, { avgTemperature: 40, tempTrend: 0.15, batteryHealth: 64, operatingHoursK: 38, daysSinceService: 480, pastFailures: 3, errorRate: 2.6 });
    expect(healthy.status).toBe("healthy");
    expect(worn.status).toBe("critical");
  });
});

describe("anomaly detection", () => {
  const series = (spike: number): TelemetryPoint[] =>
    Array.from({ length: 30 }, (_, d) => ({ date: `2026-10-${String(d + 1).padStart(2, "0")}`, temperature: 34 + (d % 2 ? 0.2 : -0.2) + (d === 29 ? spike : 0), batteryHealth: 90, errorCount: 0 }));

  it("flags a sudden temperature spike", () => {
    expect(detectAnomalies(series(5)).some((a) => a.metric === "temperature")).toBe(true);
  });

  it("stays quiet on steady readings", () => {
    expect(detectAnomalies(series(0))).toHaveLength(0);
  });
});
