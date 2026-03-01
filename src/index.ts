import { loadConfig, CITIES, ENSEMBLE_MODELS } from "./config";
import { AppConfig } from "./config/types";
import { fetchAllModels, aggregateForecasts, fetchDeterministicForecasts, fetchObserved, ObservedConditions } from "./weather";
import { scanWeatherMarkets } from "./market";
import { computeEdges } from "./strategy/edge";
import { generateSignals } from "./strategy/signals";
import { getClobClient, executeSignals, PositionTracker, evaluateExits, executeExits } from "./trading";
import { childLogger, todayInTz, tomorrowInTz, cToF } from "./utils";

const log = childLogger("main");

const tracker = new PositionTracker();
let shuttingDown = false;

// --- Graceful shutdown (Fix 5) ---
function onShutdown(signal: string): void {
  log.info({ signal }, "Shutdown signal received — saving state");
  shuttingDown = true;
  tracker.saveState();
  process.exit(0);
}
process.on("SIGINT", () => onShutdown("SIGINT"));
process.on("SIGTERM", () => onShutdown("SIGTERM"));

// --- Settlement check (Fix 3) ---
async function checkSettlements(config: AppConfig): Promise<void> {
  const positions = tracker.getPositions();
  if (positions.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  for (const pos of positions) {
    // Only check positions whose market date has passed
    if (pos.date >= today) continue;

    try {
      // Look up market by CLOB token ID on Gamma API
      const url = `${config.gammaApiUrl}/markets?clob_token_ids=${pos.tokenId}`;
      const res = await fetch(url);
      if (!res.ok) {
        log.warn({ tokenId: pos.tokenId.slice(0, 8), status: res.status }, "Settlement check failed");
        continue;
      }

      const markets = await res.json() as Array<{
        closed?: boolean;
        resolved?: boolean;
        outcomePrices?: string;
      }>;
      const market = Array.isArray(markets) ? markets[0] : undefined;
      if (!market) continue;

      if (market.closed || market.resolved) {
        // Determine settlement from outcomePrices: resolved markets show "1"/"0"
        let settlementPrice = 0;
        if (market.outcomePrices) {
          try {
            const prices: string[] = JSON.parse(market.outcomePrices);
            const yesPrice = parseFloat(prices[0]);
            // For resolved markets, Yes price is 1.0 (winner) or 0.0 (loser)
            if (!isNaN(yesPrice)) {
              settlementPrice = pos.side === "YES" ? yesPrice : 1 - yesPrice;
            }
          } catch { /* fallback to 0 */ }
        }

        const pnl = tracker.closePosition(pos.tokenId, settlementPrice);
        log.info(
          { tokenId: pos.tokenId.slice(0, 8), bucket: pos.bucketLabel, settlementPrice, pnl: pnl.toFixed(2) },
          "Position settled"
        );
      }
    } catch (err) {
      log.warn({ err, tokenId: pos.tokenId.slice(0, 8) }, "Error checking settlement");
    }
  }
}

// --- Live price updates (Fix 6) ---
async function updateLivePrices(config: AppConfig): Promise<void> {
  const positions = tracker.getPositions();
  if (positions.length === 0) return;

  const priceMap = new Map<string, number>();

  for (const pos of positions) {
    try {
      // Look up market by CLOB token ID on Gamma API
      const url = `${config.gammaApiUrl}/markets?clob_token_ids=${pos.tokenId}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const markets = await res.json() as Array<{ outcomePrices?: string }>;
      const market = Array.isArray(markets) ? markets[0] : undefined;
      if (!market?.outcomePrices) continue;

      try {
        const prices: string[] = JSON.parse(market.outcomePrices);
        const price = parseFloat(prices[0]); // Yes price
        if (!isNaN(price) && price > 0 && price < 1) {
          priceMap.set(pos.tokenId, price);
        }
      } catch { /* skip */ }
    } catch {
      // Non-critical — skip
    }
  }

  if (priceMap.size > 0) {
    tracker.updatePrices(priceMap);
  }
}

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
  // Track forecast probabilities for profit-taking on open positions
  const forecastMap = new Map<string, number>(); // tokenId → forecast prob

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

    // Fetch observed conditions for same-day trading constraints
    let observed: ObservedConditions | null = null;
    if (targetDates.includes(today)) {
      observed = await fetchObserved(config, cityConfig);
      if (observed) {
        log.info(
          { city: citySlug, observedHighF: observed.observedHighF, localHour: observed.localHour },
          "Observed conditions for same-day constraint"
        );
      }
    }

    for (const targetDate of targetDates) {
      // Only trade today's and tomorrow's markets
      if (targetDate !== today && targetDate !== tomorrow) {
        log.debug({ city: citySlug, date: targetDate }, "Date too far out — skipping");
        continue;
      }

      const dateMarkets = markets.filter((m) => m.date === targetDate);

      // Build bucket list from market definitions
      // Convert °C boundaries to °F so aggregator compares in consistent units
      const buckets = dateMarkets.map((m) => ({
        lower: m.unit === "°C" && m.bucketLower !== null ? cToF(m.bucketLower) : m.bucketLower,
        upper: m.unit === "°C" && m.bucketUpper !== null ? cToF(m.bucketUpper) : m.bucketUpper,
        label: m.bucketLabel,
      }));

      // Aggregate forecasts for this date
      try {
        const aggregated = aggregateForecasts(
          forecasts, targetDate, buckets, deterministicForecasts,
          targetDate === today ? observed ?? undefined : undefined
        );

        // Compute edges
        const edges = computeEdges(aggregated, dateMarkets);

        // Store forecast probabilities for all markets (used by profit-taker)
        for (const bp of aggregated.bucketProbabilities) {
          const matchingMarket = dateMarkets.find(
            (m) => m.bucketLabel === bp.label
          );
          if (matchingMarket) {
            forecastMap.set(matchingMarket.tokenId, bp.probability);
          }
        }

        // Generate trade signals
        const signals = generateSignals(edges, aggregated, config);
        allSignals.push(...signals);
      } catch (err) {
        log.error({ err, city: citySlug, date: targetDate }, "Aggregation failed");
      }
    }
  }

  // 4. Evaluate and execute exits on open positions (profit-taking / loss-cutting)
  const openPositions = tracker.getPositions();
  if (openPositions.length > 0) {
    // Build price map from current market prices
    const priceMap = new Map<string, number>();
    for (const m of allMarkets) {
      priceMap.set(m.tokenId, m.price);
    }

    const exits = evaluateExits(openPositions, forecastMap, priceMap, config);
    if (exits.length > 0) {
      const exitCount = await executeExits(exits, client, tracker, config);
      log.info({ exited: exitCount, evaluated: openPositions.length }, "Profit-taking complete");
    }
  }

  // 5. Execute new entry signals
  if (allSignals.length > 0) {
    log.info({ signalCount: allSignals.length }, "Executing trade signals");
    const results = await executeSignals(allSignals, client, tracker, config);

    const placed = results.filter((r) => r.status !== "FAILED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;
    log.info({ placed, failed }, "Execution complete");
  } else {
    log.info("No actionable signals this cycle");
  }

  // 6. Check settlements for past-date positions
  await checkSettlements(config);

  // 7. Update live prices for unrealized P&L
  await updateLivePrices(config);

  // 8. Log position summary
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

  // Save state at end of every cycle
  tracker.saveState();
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Load persisted state
  tracker.loadState();

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
    if (shuttingDown) return;
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
