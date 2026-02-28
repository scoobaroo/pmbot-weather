import { executeSignals } from "../../trading/executor";
import { PositionTracker } from "../../trading/positions";
import { TradeSignal } from "../../strategy/types";
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

function makeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
  return {
    tokenId: "token-1",
    conditionId: "cond-1",
    city: "nyc",
    date: "2025-02-25",
    bucketLabel: "45-50°F",
    side: "YES",
    edge: 0.15,
    forecastProb: 0.65,
    marketPrice: 0.5,
    sizeUsd: 25,
    kellyFraction: 0.1,
    confidence: 0.8,
    ...overrides,
  };
}

describe("executeSignals (dry run)", () => {
  it("returns DRY_RUN status", async () => {
    const tracker = new PositionTracker();
    const mockClient = {} as any;

    const results = await executeSignals(
      [makeSignal()],
      mockClient,
      tracker,
      mockConfig
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("DRY_RUN");
  });

  it("blocks orders that fail risk check", async () => {
    const tracker = new PositionTracker();
    const mockClient = {} as any;

    const results = await executeSignals(
      [makeSignal({ sizeUsd: 60 })], // exceeds max position
      mockClient,
      tracker,
      mockConfig
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("FAILED");
    expect(results[0].error).toContain("max position");
  });
});
