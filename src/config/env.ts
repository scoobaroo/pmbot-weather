import dotenv from "dotenv";
import { AppConfig } from "./types";

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function numEnv(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseFloat(val) : fallback;
}

function boolEnv(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val.toLowerCase() === "true" || val === "1";
}

export function loadConfig(): AppConfig {
  return {
    // Polymarket
    polymarketApiUrl: optionalEnv("POLYMARKET_API_URL", "https://polymarket.com"),
    clobApiUrl: optionalEnv("CLOB_API_URL", "https://clob.polymarket.com"),
    gammaApiUrl: optionalEnv("GAMMA_API_URL", "https://gamma-api.polymarket.com"),
    privateKey: boolEnv("DRY_RUN", true) ? optionalEnv("PRIVATE_KEY", "") : requireEnv("PRIVATE_KEY"),
    chainId: numEnv("CHAIN_ID", 137),

    // Weather
    openMeteoBaseUrl: optionalEnv("OPEN_METEO_BASE_URL", "https://ensemble-api.open-meteo.com/v1/ensemble"),
    nwsBaseUrl: optionalEnv("NWS_BASE_URL", "https://api.weather.gov"),

    // Strategy
    edgeThreshold: numEnv("EDGE_THRESHOLD", 0.08),
    kellyFraction: numEnv("KELLY_FRACTION", 0.5),
    maxPositionUsd: numEnv("MAX_POSITION_USD", 50),
    maxDailyLossUsd: numEnv("MAX_DAILY_LOSS_USD", 100),
    bankrollUsd: numEnv("BANKROLL_USD", 1000),

    // Operational
    pollIntervalMs: numEnv("POLL_INTERVAL_MS", 300_000), // 5 min
    dryRun: boolEnv("DRY_RUN", true),
    logLevel: optionalEnv("LOG_LEVEL", "info"),
  };
}
