/**
 * Kelly criterion position sizing.
 *
 * For a binary bet at price p (market) where true probability is q (forecast):
 *   Full Kelly: f = (q * (1/p - 1) - (1-q)) / (1/p - 1)
 *   Simplified: f = (q - p) / (1 - p)
 *
 * We use half-Kelly (multiply by fraction, default 0.5) for reduced variance.
 */

export interface KellyResult {
  fullKelly: number;
  fractionalKelly: number;
  sizeUsd: number;
}

/**
 * Compute half-Kelly position size.
 *
 * @param forecastProb - our estimate of true probability (0-1)
 * @param marketPrice  - the price to enter (0-1)
 * @param bankroll     - total available bankroll in USD
 * @param fraction     - kelly fraction (0.5 = half-kelly)
 * @returns Kelly sizing result
 */
export function kellySize(
  forecastProb: number,
  marketPrice: number,
  bankroll: number,
  fraction = 0.5
): KellyResult {
  // No edge or invalid inputs
  if (forecastProb <= marketPrice || marketPrice <= 0 || marketPrice >= 1 || bankroll <= 0) {
    return { fullKelly: 0, fractionalKelly: 0, sizeUsd: 0 };
  }

  const fullKelly = (forecastProb - marketPrice) / (1 - marketPrice);
  const fractionalKelly = fullKelly * fraction;

  // Clamp to [0, 1] - never bet more than the bankroll
  const clampedFraction = Math.max(0, Math.min(1, fractionalKelly));
  const sizeUsd = clampedFraction * bankroll;

  return {
    fullKelly,
    fractionalKelly: clampedFraction,
    sizeUsd: Math.round(sizeUsd * 100) / 100, // round to cents
  };
}
