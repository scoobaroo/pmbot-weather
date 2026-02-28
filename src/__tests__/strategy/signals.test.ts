import { generateSignals } from "../../strategy/signals";
import { EdgeResult } from "../../strategy/types";
import { AggregatedForecast } from "../../weather/types";
import { AppConfig } from "../../config/types";

const mockConfig: AppConfig = {
  polymarketApiUrl: "",
  clobApiUrl: "",
  gammaApiUrl: "",
  privateKey: "",
    proxyWallet: "",
  chainId: 137,
  openMeteoBaseUrl: "",
  nwsBaseUrl: "",
  weatherApiKey: "",
  enableHrrr: false,
  deterministicWeight: 1,
  edgeThreshold: 0.08,
  kellyFraction: 0.5,
  maxPositionUsd: 50,
  maxDailyLossUsd: 100,
  bankrollUsd: 1000,
  pollIntervalMs: 300000,
  dryRun: true,
  logLevel: "silent",
};

const mockForecast: AggregatedForecast = {
  city: "nyc",
  date: "2025-02-25",
  totalMembers: 100,
  highTemps: [],
  mean: 50,
  stdDev: 5,
  bucketProbabilities: [],
};

describe("generateSignals", () => {
  it("generates signal for edge above threshold", () => {
    const edges: EdgeResult[] = [
      {
        tokenId: "token-1",
        conditionId: "cond-1",
        city: "nyc",
        date: "2025-02-25",
        bucketLabel: "45-50°F",
        forecastProb: 0.6,
        marketPrice: 0.4,
        edge: 0.2,
        side: "YES",
      },
    ];

    const signals = generateSignals(edges, mockForecast, mockConfig);
    expect(signals).toHaveLength(1);
    expect(signals[0].sizeUsd).toBeGreaterThan(0);
    expect(signals[0].sizeUsd).toBeLessThanOrEqual(mockConfig.maxPositionUsd);
  });

  it("filters out edges below threshold", () => {
    const edges: EdgeResult[] = [
      {
        tokenId: "token-1",
        conditionId: "cond-1",
        city: "nyc",
        date: "2025-02-25",
        bucketLabel: "45-50°F",
        forecastProb: 0.53,
        marketPrice: 0.5,
        edge: 0.03, // below 8% threshold
        side: "YES",
      },
    ];

    const signals = generateSignals(edges, mockForecast, mockConfig);
    expect(signals).toHaveLength(0);
  });

  it("caps size at maxPositionUsd", () => {
    const edges: EdgeResult[] = [
      {
        tokenId: "token-1",
        conditionId: "cond-1",
        city: "nyc",
        date: "2025-02-25",
        bucketLabel: "45-50°F",
        forecastProb: 0.9,
        marketPrice: 0.1,
        edge: 0.8,
        side: "YES",
      },
    ];

    const signals = generateSignals(edges, mockForecast, mockConfig);
    expect(signals).toHaveLength(1);
    expect(signals[0].sizeUsd).toBe(mockConfig.maxPositionUsd);
  });

  it("sorts signals by edge descending", () => {
    const edges: EdgeResult[] = [
      {
        tokenId: "t1", conditionId: "c1", city: "nyc", date: "2025-02-25",
        bucketLabel: "a", forecastProb: 0.6, marketPrice: 0.4, edge: 0.2, side: "YES",
      },
      {
        tokenId: "t2", conditionId: "c2", city: "nyc", date: "2025-02-25",
        bucketLabel: "b", forecastProb: 0.8, marketPrice: 0.4, edge: 0.4, side: "YES",
      },
    ];

    const signals = generateSignals(edges, mockForecast, mockConfig);
    expect(signals[0].edge).toBeGreaterThan(signals[1].edge);
  });
});
