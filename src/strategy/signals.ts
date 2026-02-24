import { EdgeResult, TradeSignal } from "./types";
import { kellySize } from "./kelly";
import { AppConfig } from "../config/types";
import { AggregatedForecast } from "../weather/types";
import { childLogger } from "../utils/logger";

const log = childLogger("signals");

/**
 * Generate actionable trade signals from edge results.
 * Filters by edge threshold, applies Kelly sizing, respects risk limits.
 */
export function generateSignals(
  edges: EdgeResult[],
  forecast: AggregatedForecast,
  config: AppConfig
): TradeSignal[] {
  const signals: TradeSignal[] = [];

  for (const edge of edges) {
    // Skip if edge below threshold
    if (edge.edge < config.edgeThreshold) {
      log.debug(
        { bucket: edge.bucketLabel, edge: edge.edge.toFixed(3) },
        "Edge below threshold"
      );
      continue;
    }

    // Compute Kelly size
    const kelly = kellySize(
      edge.forecastProb,
      edge.marketPrice,
      config.bankrollUsd,
      config.kellyFraction
    );

    if (kelly.sizeUsd < 1) {
      log.debug({ bucket: edge.bucketLabel }, "Kelly size too small");
      continue;
    }

    // Cap at max position
    const sizeUsd = Math.min(kelly.sizeUsd, config.maxPositionUsd);

    // Confidence based on ensemble agreement (lower stddev = higher confidence)
    const confidence = Math.max(0, Math.min(1, 1 - forecast.stdDev / 20));

    signals.push({
      tokenId: edge.tokenId,
      conditionId: edge.conditionId,
      city: edge.city,
      date: edge.date,
      bucketLabel: edge.bucketLabel,
      side: edge.side,
      edge: edge.edge,
      forecastProb: edge.forecastProb,
      marketPrice: edge.marketPrice,
      sizeUsd,
      kellyFraction: kelly.fractionalKelly,
      confidence,
    });
  }

  // Sort by edge descending — best opportunities first
  signals.sort((a, b) => b.edge - a.edge);

  log.info(
    {
      edgesIn: edges.length,
      signalsOut: signals.length,
      topEdge: signals[0]?.edge.toFixed(3),
    },
    "Generated trade signals"
  );

  return signals;
}
