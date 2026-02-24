/**
 * Basic statistical functions and kernel density estimation.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Gaussian kernel density estimation.
 * Returns the estimated PDF value at point x given samples.
 * Uses Silverman's rule of thumb for bandwidth if not provided.
 */
export function gaussianKDE(x: number, samples: number[], bandwidth?: number): number {
  const n = samples.length;
  if (n === 0) return 0;

  const h = bandwidth ?? silvermanBandwidth(samples);
  if (h === 0) return 0;

  let sum = 0;
  for (const xi of samples) {
    const u = (x - xi) / h;
    sum += Math.exp(-0.5 * u * u);
  }

  return sum / (n * h * Math.sqrt(2 * Math.PI));
}

/**
 * Silverman's rule of thumb bandwidth.
 */
export function silvermanBandwidth(samples: number[]): number {
  const n = samples.length;
  if (n < 2) return 1;
  const s = stdDev(samples);
  if (s === 0) return 1;
  return 1.06 * s * Math.pow(n, -0.2);
}

/**
 * Integrate a PDF (via KDE) over [lower, upper] using the trapezoidal rule.
 * Uses `steps` evenly spaced evaluation points.
 */
export function integratePdf(
  samples: number[],
  lower: number,
  upper: number,
  bandwidth?: number,
  steps = 200
): number {
  if (lower >= upper) return 0;

  const h = (upper - lower) / steps;
  let sum = 0;

  for (let i = 0; i <= steps; i++) {
    const x = lower + i * h;
    const y = gaussianKDE(x, samples, bandwidth);
    if (i === 0 || i === steps) {
      sum += y;
    } else {
      sum += 2 * y;
    }
  }

  return (h / 2) * sum;
}

/**
 * Compute probability that value falls within [lower, upper] using empirical counting.
 * Simpler and faster than KDE for large sample counts.
 */
export function empiricalProbability(
  samples: number[],
  lower: number | null,
  upper: number | null
): number {
  if (samples.length === 0) return 0;
  const count = samples.filter((v) => {
    if (lower !== null && v < lower) return false;
    if (upper !== null && v > upper) return false;
    return true;
  }).length;
  return count / samples.length;
}
