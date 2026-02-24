import { EnsembleForecast, AggregatedForecast, BucketProbability, EnsembleMember } from "./types";
import { mean, stdDev, empiricalProbability } from "../utils/math";
import { childLogger } from "../utils/logger";

const log = childLogger("aggregator");

/**
 * Pool all ensemble members across models and compute daily high temperatures,
 * then derive bucket probabilities.
 */
export function aggregateForecasts(
  forecasts: EnsembleForecast[],
  targetDate: string,
  buckets: Array<{ lower: number | null; upper: number | null; label: string }>
): AggregatedForecast {
  const allMembers: EnsembleMember[] = [];
  for (const f of forecasts) {
    allMembers.push(...f.members);
  }

  if (allMembers.length === 0) {
    throw new Error(`No ensemble members available for ${targetDate}`);
  }

  const city = forecasts[0].city;

  // Extract daily high for target date from each member
  const highTemps = extractDailyHighs(allMembers, targetDate);

  if (highTemps.length === 0) {
    throw new Error(`No temperature data for ${targetDate} in any member`);
  }

  const m = mean(highTemps);
  const sd = stdDev(highTemps);

  log.info(
    {
      city,
      date: targetDate,
      members: highTemps.length,
      mean: m.toFixed(1),
      stdDev: sd.toFixed(1),
    },
    "Aggregated ensemble"
  );

  // Compute bucket probabilities using empirical counting
  const bucketProbabilities = computeBucketProbabilities(highTemps, buckets);

  return {
    city,
    date: targetDate,
    totalMembers: highTemps.length,
    highTemps,
    mean: m,
    stdDev: sd,
    bucketProbabilities,
  };
}

/**
 * Extract the daily high temperature for a given date from each ensemble member.
 */
export function extractDailyHighs(members: EnsembleMember[], targetDate: string): number[] {
  const highs: number[] = [];

  for (const member of members) {
    let maxTemp = -Infinity;
    let found = false;

    for (let i = 0; i < member.times.length; i++) {
      const timeStr = member.times[i];
      // times are ISO format: "2024-02-25T00:00" or with timezone
      if (timeStr.startsWith(targetDate)) {
        found = true;
        if (member.temperatures[i] != null && member.temperatures[i] > maxTemp) {
          maxTemp = member.temperatures[i];
        }
      }
    }

    if (found && maxTemp > -Infinity) {
      highs.push(maxTemp);
    }
  }

  return highs;
}

/**
 * Compute probability for each bucket using empirical counting.
 */
export function computeBucketProbabilities(
  highTemps: number[],
  buckets: Array<{ lower: number | null; upper: number | null; label: string }>
): BucketProbability[] {
  return buckets.map((bucket) => ({
    ...bucket,
    probability: empiricalProbability(highTemps, bucket.lower, bucket.upper),
  }));
}
