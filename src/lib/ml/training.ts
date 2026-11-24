import { FEATURES, toVector, type FeatureVector } from "./features";
import { evaluate, rocCurve, predictProbability, sigmoid, trainLogisticRegression } from "./model";
import { clamp, createRng, gaussian, poisson, shuffle, type Rng } from "./random";

export const TRAINING_SAMPLES = 2400;

/** Synthetic historical equipment records (stand-in for a hospital CMMS export). */
function sampleRecord(rng: Rng): FeatureVector {
  const degrading = rng() < 0.32;
  const g = () => gaussian(rng);
  return {
    avgTemperature: degrading ? 37.4 + g() * 2.6 : 34 + g() * 1.4,
    tempTrend: degrading ? 0.08 + g() * 0.06 : g() * 0.02,
    batteryHealth: clamp(degrading ? 73 + g() * 11 : 90 + g() * 5.5, 35, 100),
    operatingHoursK: clamp(degrading ? 24 + g() * 10 : 13 + g() * 7, 0.5, 60),
    daysSinceService: clamp(degrading ? 320 + g() * 140 : 160 + g() * 90, 0, 800),
    pastFailures: poisson(rng, degrading ? 1.6 : 0.4),
    errorRate: clamp(degrading ? 1.7 + g() * 0.9 : 0.4 + g() * 0.3, 0, 8),
  };
}

/** Hidden failure mechanism used only to label the synthetic history. */
function failureLogit(f: FeatureVector) {
  return (
    -3.0 +
    0.42 * (f.avgTemperature - 35) +
    9 * f.tempTrend +
    0.075 * (82 - f.batteryHealth) +
    0.05 * (f.operatingHoursK - 15) +
    0.004 * (f.daysSinceService - 200) +
    0.35 * f.pastFailures +
    0.75 * (f.errorRate - 0.8)
  );
}

export function generateTrainingData(seed = 42, n = TRAINING_SAMPLES) {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => {
    const features = sampleRecord(rng);
    const label = rng() < sigmoid(failureLogit(features)) ? 1 : 0;
    return { features, label };
  });
}

export function trainFailureModel(seed = 42) {
  const rng = createRng(seed + 1);
  const data = shuffle(rng, generateTrainingData(seed));
  const split = Math.floor(data.length * 0.75);
  const train = data.slice(0, split);
  const test = data.slice(split);

  const model = trainLogisticRegression(
    train.map((r) => toVector(r.features)),
    train.map((r) => r.label),
  );

  const yTest = test.map((r) => r.label);
  const probs = test.map((r) => predictProbability(model, toVector(r.features)));
  const metrics = evaluate(yTest, probs);

  const totalWeight = model.weights.reduce((a, w) => a + Math.abs(w), 0);
  const featureImportance = FEATURES.map((f, j) => ({
    key: f.key,
    label: f.label,
    weight: model.weights[j],
    importance: Math.abs(model.weights[j]!) / totalWeight,
  })).sort((a, b) => b.importance - a.importance);

  return {
    model,
    metrics,
    roc: rocCurve(yTest, probs),
    featureImportance,
    trainSize: train.length,
    testSize: test.length,
    positiveRate: data.filter((r) => r.label === 1).length / data.length,
  };
}
