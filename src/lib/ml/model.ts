/**
 * Logistic regression trained with full-batch gradient descent on standardized features.
 * Outputs P(failure within 30 days).
 */
export interface LogisticModel {
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function trainLogisticRegression(
  X: number[][],
  y: number[],
  { epochs = 700, learningRate = 0.5, l2 = 0.001 } = {},
): LogisticModel {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  for (const row of X) row.forEach((v, j) => (means[j] += v / n));
  for (const row of X) row.forEach((v, j) => (stds[j] += (v - means[j]) ** 2 / n));
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j]!) || 1;

  const Xs = X.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
  const w = new Array(d).fill(0);
  let b = 0;

  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const xi = Xs[i]!;
      let z = b;
      for (let j = 0; j < d; j++) z += w[j]! * xi[j]!;
      const err = sigmoid(z) - y[i]!;
      for (let j = 0; j < d; j++) gw[j] += err * xi[j]!;
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= learningRate * (gw[j]! / n + l2 * w[j]!);
    b -= (learningRate * gb) / n;
  }
  return { weights: w, bias: b, means, stds };
}

const standardize = (m: LogisticModel, x: number[]) => x.map((v, j) => (v - m.means[j]!) / m.stds[j]!);

export function predictProbability(m: LogisticModel, x: number[]) {
  const xs = standardize(m, x);
  return sigmoid(xs.reduce((z, v, j) => z + m.weights[j]! * v, m.bias));
}

/** Per-feature contribution to the log-odds (weight × standardized value). */
export const featureContributions = (m: LogisticModel, x: number[]) =>
  standardize(m, x).map((v, j) => m.weights[j]! * v);

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export function rocAuc(yTrue: number[], probs: number[]) {
  const pairs = probs.map((p, i) => ({ p, y: yTrue[i] })).sort((a, b) => a.p - b.p);
  let rankSum = 0;
  let pos = 0;
  pairs.forEach((pair, i) => {
    if (pair.y === 1) {
      rankSum += i + 1;
      pos++;
    }
  });
  const neg = pairs.length - pos;
  if (pos === 0 || neg === 0) return 0.5;
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

export function evaluate(yTrue: number[], probs: number[], threshold = 0.5): ClassificationMetrics {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  probs.forEach((p, i) => {
    const pred = p >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp++;
    else if (pred === 1) fp++;
    else if (yTrue[i] === 0) tn++;
    else fn++;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    accuracy: (tp + tn) / probs.length,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    auc: rocAuc(yTrue, probs),
    tp, fp, tn, fn,
  };
}

export function rocCurve(yTrue: number[], probs: number[]) {
  const pos = yTrue.filter((y) => y === 1).length;
  const neg = yTrue.length - pos;
  const points: { fpr: number; tpr: number }[] = [];
  for (let t = 1; t >= -0.0001; t -= 0.02) {
    let tp = 0, fp = 0;
    probs.forEach((p, i) => {
      if (p < t) return;
      if (yTrue[i] === 1) tp++;
      else fp++;
    });
    points.push({ fpr: fp / neg, tpr: tp / pos });
  }
  return points;
}
