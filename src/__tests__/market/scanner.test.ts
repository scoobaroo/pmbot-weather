import { scanWeatherMarkets } from "../../market/scanner";

const originalFetch = global.fetch;

describe("scanWeatherMarkets", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses weather events from Gamma API", async () => {
    const mockEvents = [
      {
        id: "event-1",
        slug: "nyc-temp-feb-25",
        title: "NYC Temperature February 25",
        description: "Temperature markets for NYC",
        endDate: "2025-02-26",
        active: true,
        markets: [
          {
            id: "market-1",
            conditionId: "cond-1",
            question: "Will the high temperature in NYC on February 25 be between 40°F and 44°F?",
            tokens: [
              { token_id: "yes-token-1", outcome: "Yes" },
              { token_id: "no-token-1", outcome: "No" },
            ],
            outcomePrices: "[0.35, 0.65]",
          },
        ],
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEvents),
    });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");

    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events[0];
    expect(event.markets.length).toBeGreaterThanOrEqual(1);
    expect(event.markets[0].city).toBe("nyc");
    expect(event.markets[0].tokenId).toBe("yes-token-1");
    expect(event.markets[0].price).toBeCloseTo(0.35);
    expect(event.markets[0].bucketLower).toBe(40);
    expect(event.markets[0].bucketUpper).toBe(44);
  });

  it("handles empty response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");
    expect(events).toEqual([]);
  });
});
