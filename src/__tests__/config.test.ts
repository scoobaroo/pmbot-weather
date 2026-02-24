import { loadConfig } from '../config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads config with all required env variables set', () => {
    process.env.WEATHER_API_KEY = 'test-weather-key';

    const config = loadConfig();

    expect(config.weather.apiKey).toBe('test-weather-key');
    expect(config.weather.baseUrl).toBe('https://api.openweathermap.org/data/2.5');
    expect(config.polymarket.baseUrl).toBe('https://clob.polymarket.com');
    expect(config.strategy.minConfidence).toBe(0.65);
    expect(config.strategy.maxPositionSizeUsd).toBe(100);
    expect(config.strategy.pollIntervalMs).toBe(60000);
  });

  it('throws when WEATHER_API_KEY is missing', () => {
    delete process.env.WEATHER_API_KEY;

    expect(() => loadConfig()).toThrow('Missing required environment variable: WEATHER_API_KEY');
  });

  it('respects custom env variable overrides', () => {
    process.env.WEATHER_API_KEY = 'my-key';
    process.env.WEATHER_BASE_URL = 'https://custom.weather.api/v3';
    process.env.POLYMARKET_BASE_URL = 'https://staging.polymarket.com';
    process.env.STRATEGY_MIN_CONFIDENCE = '0.80';
    process.env.STRATEGY_MAX_POSITION_SIZE_USD = '500';
    process.env.STRATEGY_POLL_INTERVAL_MS = '30000';

    const config = loadConfig();

    expect(config.weather.baseUrl).toBe('https://custom.weather.api/v3');
    expect(config.polymarket.baseUrl).toBe('https://staging.polymarket.com');
    expect(config.strategy.minConfidence).toBe(0.80);
    expect(config.strategy.maxPositionSizeUsd).toBe(500);
    expect(config.strategy.pollIntervalMs).toBe(30000);
  });

  it('sets polymarket credentials from env', () => {
    process.env.WEATHER_API_KEY = 'test-key';
    process.env.POLYMARKET_API_KEY = 'poly-api-key';
    process.env.POLYMARKET_PRIVATE_KEY = 'poly-private-key';

    const config = loadConfig();

    expect(config.polymarket.apiKey).toBe('poly-api-key');
    expect(config.polymarket.privateKey).toBe('poly-private-key');
  });
});
