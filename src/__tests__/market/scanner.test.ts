import { scanWeatherMarkets } from "../../market/scanner";

const originalFetch = global.fetch;

describe("scanWeatherMarkets", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses weather events from Gamma API using tag_id", async () => {
    const mockEvents = [
      {
        id: "event-1",
        slug: "highest-temperature-in-nyc-on-march-1-2026",
        title: "Highest temperature in NYC on March 1?",
        description: "Temperature markets for NYC",
        endDate: "2026-03-01",
        active: true,
        markets: [
          {
            conditionId: "cond-1",
            question: "Will the highest temperature in New York City be between 32-33°F on March 1?",
            clobTokenIds: '["yes-token-1", "no-token-1"]',
            outcomePrices: '["0.35", "0.65"]',
            closed: false,
            active: true,
            acceptingOrders: true,
          },
          {
            conditionId: "cond-2",
            question: "Will the highest temperature in New York City be between 34-35°F on March 1?",
            clobTokenIds: '["yes-token-2", "no-token-2"]',
            outcomePrices: '["0.25", "0.75"]',
            closed: false,
            active: true,
            acceptingOrders: true,
          },
        ],
      },
    ];

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");

    expect(events.length).toBe(1);
    const event = events[0];
    expect(event.markets.length).toBe(2);
    expect(event.markets[0].city).toBe("nyc");
    expect(event.markets[0].tokenId).toBe("yes-token-1");
    expect(event.markets[0].price).toBeCloseTo(0.35);
    expect(event.markets[0].bucketLower).toBe(32);
    expect(event.markets[0].bucketUpper).toBe(33);
    expect(event.markets[0].unit).toBe("°F");
    expect(event.markets[1].tokenId).toBe("yes-token-2");
    expect(event.markets[1].price).toBeCloseTo(0.25);
    expect(event.markets[1].unit).toBe("°F");
  });

  it("handles empty response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");
    expect(events).toEqual([]);
  });

  it("skips markets not accepting orders", async () => {
    const mockEvents = [
      {
        id: "event-1",
        slug: "highest-temperature-in-nyc-on-march-1-2026",
        title: "Highest temperature in NYC on March 1?",
        description: "",
        endDate: "2026-03-01",
        active: true,
        markets: [
          {
            conditionId: "cond-1",
            question: "Will the highest temperature in New York City be between 32-33°F on March 1?",
            clobTokenIds: '["yes-token-1", "no-token-1"]',
            outcomePrices: '["0.35", "0.65"]',
            closed: false,
            active: true,
            acceptingOrders: false,
          },
        ],
      },
    ];

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");
    // Event has no accepting markets, so it's excluded
    expect(events).toEqual([]);
  });

  it("parses Celsius markets correctly", async () => {
    const mockEvents = [
      {
        id: "event-1",
        slug: "highest-temperature-in-london-on-march-1-2026",
        title: "Highest temperature in London on March 1?",
        description: "",
        endDate: "2026-03-01",
        active: true,
        markets: [
          {
            conditionId: "cond-1",
            question: "Will the highest temperature in London be 6°C or below on March 1?",
            clobTokenIds: '["yes-token-1", "no-token-1"]',
            outcomePrices: '["0.15", "0.85"]',
            closed: false,
            active: true,
            acceptingOrders: true,
          },
          {
            conditionId: "cond-2",
            question: "Will the highest temperature in London be between 7–8°C on March 1?",
            clobTokenIds: '["yes-token-2", "no-token-2"]',
            outcomePrices: '["0.40", "0.60"]',
            closed: false,
            active: true,
            acceptingOrders: true,
          },
        ],
      },
    ];

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    const events = await scanWeatherMarkets("https://gamma-api.polymarket.com");
    expect(events.length).toBe(1);
    expect(events[0].markets.length).toBe(2);
    expect(events[0].markets[0].bucketUpper).toBe(6);
    expect(events[0].markets[0].bucketLower).toBeNull();
    expect(events[0].markets[0].bucketLabel).toBe("6°C or lower");
    expect(events[0].markets[0].unit).toBe("°C");
    expect(events[0].markets[1].bucketLower).toBe(7);
    expect(events[0].markets[1].bucketUpper).toBe(8);
    expect(events[0].markets[1].bucketLabel).toBe("7-8°C");
    expect(events[0].markets[1].unit).toBe("°C");
  });
});
