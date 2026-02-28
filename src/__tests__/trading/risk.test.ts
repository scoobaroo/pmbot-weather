import { evaluateRisk, canPlaceTrade } from "../../trading/risk";
import { Position } from "../../trading/types";
import { AppConfig } from "../../config/types";

const mockConfig: AppConfig = {
  polymarketApiUrl: "",
  clobApiUrl: "",
  gammaApiUrl: "",
  privateKey: "",
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

function makePosition(costBasis: number): Position {
  return {
    tokenId: "t1",
    conditionId: "c1",
    city: "nyc",
    date: "2025-02-25",
    bucketLabel: "test",
    side: "YES",
    avgPrice: 0.5,
    size: costBasis / 0.5,
    costBasis,
    currentPrice: 0.5,
    unrealizedPnl: 0,
    openedAt: new Date().toISOString(),
  };
}

describe("evaluateRisk", () => {
  it("allows trading with no positions", () => {
    const risk = evaluateRisk([], 0, mockConfig);
    expect(risk.canTrade).toBe(true);
    expect(risk.totalExposure).toBe(0);
  });

  it("blocks trading when daily loss limit hit", () => {
    const risk = evaluateRisk([], -100, mockConfig);
    expect(risk.canTrade).toBe(false);
    expect(risk.dailyLossLimitHit).toBe(true);
  });

  it("blocks trading when max exposure reached", () => {
    const positions = [makePosition(260)]; // 260 >= 50*5
    const risk = evaluateRisk(positions, 0, mockConfig);
    expect(risk.canTrade).toBe(false);
    expect(risk.maxPositionReached).toBe(true);
  });
});

describe("canPlaceTrade", () => {
  it("allows trade within limits", () => {
    const result = canPlaceTrade(25, [], 0, mockConfig);
    expect(result.allowed).toBe(true);
  });

  it("blocks trade exceeding max position", () => {
    const result = canPlaceTrade(60, [], 0, mockConfig);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("max position");
  });

  it("blocks trade that would exceed bankroll", () => {
    // Use a config with higher max exposure so bankroll check fires first
    const bigConfig = { ...mockConfig, maxPositionUsd: 500 };
    const positions = [makePosition(980)];
    const result = canPlaceTrade(30, positions, 0, bigConfig);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("bankroll");
  });
});
