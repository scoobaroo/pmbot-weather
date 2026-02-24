import { computeEdges } from "../../strategy/edge";
import { AggregatedForecast, BucketProbability } from "../../weather/types";
import { WeatherMarket } from "../../market/types";

function makeForecast(buckets: BucketProbability[]): AggregatedForecast {
  return {
    city: "nyc",
    date: "2025-02-25",
    totalMembers: 100,
    highTemps: [],
    mean: 50,
    stdDev: 5,
    bucketProbabilities: buckets,
  };
}

function makeMarket(overrides: Partial<WeatherMarket> = {}): WeatherMarket {
  return {
    conditionId: "cond-1",
    tokenId: "token-1",
    outcome: "Yes",
    price: 0.5,
    question: "test",
    city: "nyc",
    date: "2025-02-25",
    bucketLower: 45,
    bucketUpper: 50,
    bucketLabel: "45-50°F",
    ...overrides,
  };
}

describe("computeEdges", () => {
  it("detects positive YES edge when forecast > market", () => {
    const forecast = makeForecast([
      { lower: 45, upper: 50, label: "45-50°F", probability: 0.7 },
    ]);
    const markets = [makeMarket({ price: 0.5 })];

    const edges = computeEdges(forecast, markets);
    expect(edges).toHaveLength(1);
    expect(edges[0].side).toBe("YES");
    expect(edges[0].edge).toBeCloseTo(0.2);
  });

  it("detects positive NO edge when forecast < market", () => {
    const forecast = makeForecast([
      { lower: 45, upper: 50, label: "45-50°F", probability: 0.3 },
    ]);
    const markets = [makeMarket({ price: 0.5 })];

    const edges = computeEdges(forecast, markets);
    expect(edges).toHaveLength(1);
    expect(edges[0].side).toBe("NO");
    expect(edges[0].edge).toBeCloseTo(0.2);
  });

  it("returns empty when no edge", () => {
    const forecast = makeForecast([
      { lower: 45, upper: 50, label: "45-50°F", probability: 0.5 },
    ]);
    const markets = [makeMarket({ price: 0.5 })];

    const edges = computeEdges(forecast, markets);
    expect(edges).toHaveLength(0);
  });

  it("skips markets without matching bucket", () => {
    const forecast = makeForecast([
      { lower: 45, upper: 50, label: "45-50°F", probability: 0.7 },
    ]);
    const markets = [makeMarket({ bucketLower: 50, bucketUpper: 55, bucketLabel: "50-55°F" })];

    const edges = computeEdges(forecast, markets);
    expect(edges).toHaveLength(0);
  });
});
