import { loadConfig, CITIES, ENSEMBLE_MODELS } from "./config";
import { fetchAllModels, aggregateForecasts, fetchDeterministicForecasts } from "./weather";
import { scanWeatherMarkets } from "./market";
import { computeEdges } from "./strategy/edge";
import { generateSignals } from "./strategy/signals";
import { getClobClient, executeSignals, PositionTracker } from "./trading";
import { childLogger, todayInTz, tomorrowInTz } from "./utils";

const log = childLogger("main");

const tracker = new PositionTracker();

async function runCycle(): Promise<void> {
  const config = loadConfig();
  log.info({ dryRun: config.dryRun }, "Starting trade cycle");

  // 1. Scan for active weather markets
  const events = await scanWeatherMarkets(config.gammaApiUrl);
  const allMarkets = events.flatMap((e) => e.markets);
  log.info({ marketCount: allMarkets.length }, "Active weather markets");

  if (allMarkets.length === 0) {
    log.info("No weather markets found — skipping cycle");
    return;
  }

  // 2. Group markets by city
  const marketsByCity = new Map<string, typeof allMarkets>();
  for (const m of allMarkets) {
    const existing = marketsByCity.get(m.city) || [];
    existing.push(m);
    marketsByCity.set(m.city, existing);
  }

  // 3. For each city with markets, fetch forecasts and compute edges
  const client = await getClobClient(config);
  const allSignals: Awaited<ReturnType<typeof generateSignals>> = [];

  for (const [citySlug, markets] of marketsByCity) {
    const cityConfig = CITIES.find((c) => c.slug === citySlug);
    if (!cityConfig) {
      log.warn({ city: citySlug }, "Unknown city — skipping");
      continue;
    }

    // Fetch ensemble forecasts
    const forecasts = await fetchAllModels(
      config.openMeteoBaseUrl,
      cityConfig,
      ENSEMBLE_MODELS
    );

    if (forecasts.length === 0) {
      log.warn({ city: citySlug }, "No forecasts available — skipping");
      continue;
    }

    // Get target dates from markets
    const targetDates = [...new Set(markets.map((m) => m.date))];
    const today = todayInTz(cityConfig.timezone);
    const tomorrow = tomorrowInTz(cityConfig.timezone);

    // Fetch deterministic forecasts from all available sources
    const deterministicForecasts = await fetchDeterministicForecasts(config, cityConfig, targetDates);

    for (const targetDate of targetDates) {
      // Only trade today's and tomorrow's markets
      if (targetDate !== today && targetDate !== tomorrow) {
        log.debug({ city: citySlug, date: targetDate }, "Date too far out — skipping");
        continue;
      }

      const dateMarkets = markets.filter((m) => m.date === targetDate);

      // Build bucket list from market definitions
      const buckets = dateMarkets.map((m) => ({
        lower: m.bucketLower,
        upper: m.bucketUpper,
        label: m.bucketLabel,
      }));

      // Aggregate forecasts for this date
      try {
        const aggregated = aggregateForecasts(forecasts, targetDate, buckets, deterministicForecasts);

        // Compute edges
        const edges = computeEdges(aggregated, dateMarkets);

        // Generate trade signals
        const signals = generateSignals(edges, aggregated, config);
        allSignals.push(...signals);
      } catch (err) {
        log.error({ err, city: citySlug, date: targetDate }, "Aggregation failed");
      }
    }
  }

  // 4. Execute signals
  if (allSignals.length > 0) {
    log.info({ signalCount: allSignals.length }, "Executing trade signals");
    const results = await executeSignals(allSignals, client, tracker, config);

    const placed = results.filter((r) => r.status !== "FAILED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;
    log.info({ placed, failed }, "Execution complete");
  } else {
    log.info("No actionable signals this cycle");
  }

  // 5. Log position summary
  const positions = tracker.getPositions();
  if (positions.length > 0) {
    log.info(
      {
        openPositions: positions.length,
        realizedPnl: tracker.getRealizedPnl().toFixed(2),
        unrealizedPnl: tracker.getUnrealizedPnl().toFixed(2),
      },
      "Position summary"
    );
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  log.info(
    {
      dryRun: config.dryRun,
      edgeThreshold: `${(config.edgeThreshold * 100).toFixed(0)}%`,
      kellyFraction: config.kellyFraction,
      pollInterval: `${config.pollIntervalMs / 1000}s`,
      bankroll: `$${config.bankrollUsd}`,
    },
    "pmbot-weather starting"
  );

  // Run first cycle immediately
  await runCycle();

  // Schedule recurring cycles
  setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      log.error({ err }, "Cycle failed");
    }
  }, config.pollIntervalMs);
}

main().catch((err) => {
  log.fatal({ err }, "Fatal error");
  process.exit(1);
});
