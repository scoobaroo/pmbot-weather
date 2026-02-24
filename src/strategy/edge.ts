import { AggregatedForecast, BucketProbability } from "../weather/types";
import { WeatherMarket } from "../market/types";
import { EdgeResult } from "./types";
import { childLogger } from "../utils/logger";

const log = childLogger("edge");

/**
 * Compute the edge between forecast probability and market price for each market.
 * Returns edges for both YES and NO sides, keeping whichever has positive edge.
 */
export function computeEdges(
  forecast: AggregatedForecast,
  markets: WeatherMarket[]
): EdgeResult[] {
  const edges: EdgeResult[] = [];

  for (const market of markets) {
    // Find matching bucket in forecast
    const bucket = findMatchingBucket(forecast.bucketProbabilities, market);
    if (!bucket) {
      log.debug(
        { market: market.bucketLabel, city: market.city },
        "No matching bucket in forecast"
      );
      continue;
    }

    const forecastProb = bucket.probability;
    const marketPrice = market.price;

    // YES side: we profit if outcome is yes, paying marketPrice
    const yesEdge = forecastProb - marketPrice;

    // NO side: we profit if outcome is no, paying (1 - marketPrice)
    const noEdge = (1 - forecastProb) - (1 - marketPrice);
    // noEdge simplifies to marketPrice - forecastProb, i.e. -yesEdge

    // Keep the side with positive edge
    if (yesEdge > 0) {
      edges.push({
        tokenId: market.tokenId,
        conditionId: market.conditionId,
        city: market.city,
        date: market.date,
        bucketLabel: market.bucketLabel,
        forecastProb,
        marketPrice,
        edge: yesEdge,
        side: "YES",
      });
    } else if (noEdge > 0) {
      edges.push({
        tokenId: market.tokenId,
        conditionId: market.conditionId,
        city: market.city,
        date: market.date,
        bucketLabel: market.bucketLabel,
        forecastProb,
        marketPrice: 1 - marketPrice,
        edge: noEdge,
        side: "NO",
      });
    }
  }

  log.info(
    {
      city: forecast.city,
      date: forecast.date,
      marketsChecked: markets.length,
      edgesFound: edges.length,
    },
    "Edge computation complete"
  );

  return edges;
}

function findMatchingBucket(
  buckets: BucketProbability[],
  market: WeatherMarket
): BucketProbability | null {
  for (const b of buckets) {
    if (b.lower === market.bucketLower && b.upper === market.bucketUpper) {
      return b;
    }
  }
  return null;
}
