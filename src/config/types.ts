export interface CityConfig {
  name: string;
  slug: string; // polymarket slug fragment e.g. "nyc"
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
}

export interface EnsembleModelConfig {
  name: string;
  memberCount: number;
  apiParam: string; // Open-Meteo model parameter value
}

export interface AppConfig {
  // Polymarket
  polymarketApiUrl: string;
  clobApiUrl: string;
  gammaApiUrl: string;
  privateKey: string;
  proxyWallet: string;
  chainId: number;

  // Weather
  openMeteoBaseUrl: string;
  nwsBaseUrl: string;
  weatherApiKey: string;
  enableHrrr: boolean;
  deterministicWeight: number;

  // Strategy
  edgeThreshold: number; // minimum edge to trade (e.g. 0.08 = 8%)
  kellyFraction: number; // fraction of full kelly (0.5 = half-kelly)
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  bankrollUsd: number;

  // Operational
  pollIntervalMs: number;
  dryRun: boolean;
  logLevel: string;
}
