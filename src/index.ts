import { loadConfig } from './config';
import { WeatherService } from './weather/weatherService';
import { PolymarketClient } from './market/polymarketClient';
import { WeatherStrategy } from './strategy/weatherStrategy';

async function main(): Promise<void> {
  const config = loadConfig();

  const weatherService = new WeatherService(
    config.weather.apiKey,
    config.weather.baseUrl
  );

  const polymarketClient = new PolymarketClient(
    config.polymarket.apiKey,
    config.polymarket.baseUrl
  );

  const strategy = new WeatherStrategy(weatherService, polymarketClient, {
    locations: (process.env.STRATEGY_LOCATIONS ?? 'New York,London,Tokyo').split(','),
    minConfidence: config.strategy.minConfidence,
    maxPositionSizeUsd: config.strategy.maxPositionSizeUsd,
  });

  console.log('pmbot-weather started');
  console.log(`Poll interval: ${config.strategy.pollIntervalMs}ms`);

  const runCycle = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}] Running strategy cycle...`);
    try {
      const signals = await strategy.findTradeSignals();
      console.log(`Found ${signals.length} trade signal(s)`);

      for (const signal of signals) {
        console.log(
          `  Signal: ${signal.side} ${signal.outcome} @ ${signal.price} ` +
            `(confidence: ${(signal.confidence * 100).toFixed(1)}%) — ${signal.reasoning}`
        );

        await polymarketClient.placeLimitOrder(
          signal.marketId,
          signal.outcomeIndex,
          signal.side,
          signal.price,
          config.strategy.maxPositionSizeUsd * signal.confidence
        );
      }
    } catch (err) {
      console.error('Strategy cycle error:', err);
    }
  };

  await runCycle();
  setInterval(runCycle, config.strategy.pollIntervalMs);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
