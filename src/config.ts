import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  weather: {
    apiKey: string;
    baseUrl: string;
  };
  polymarket: {
    apiKey: string;
    privateKey: string;
    baseUrl: string;
  };
  strategy: {
    minConfidence: number;
    maxPositionSizeUsd: number;
    pollIntervalMs: number;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export function loadConfig(): Config {
  return {
    weather: {
      apiKey: requireEnv('WEATHER_API_KEY'),
      baseUrl: getEnv('WEATHER_BASE_URL', 'https://api.openweathermap.org/data/2.5'),
    },
    polymarket: {
      apiKey: getEnv('POLYMARKET_API_KEY', ''),
      privateKey: getEnv('POLYMARKET_PRIVATE_KEY', ''),
      baseUrl: getEnv('POLYMARKET_BASE_URL', 'https://clob.polymarket.com'),
    },
    strategy: {
      minConfidence: parseFloat(getEnv('STRATEGY_MIN_CONFIDENCE', '0.65')),
      maxPositionSizeUsd: parseFloat(getEnv('STRATEGY_MAX_POSITION_SIZE_USD', '100')),
      pollIntervalMs: parseInt(getEnv('STRATEGY_POLL_INTERVAL_MS', '60000'), 10),
    },
  };
}
