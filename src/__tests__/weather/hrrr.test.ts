import { fetchHrrrForecast } from "../../weather/hrrr";
import { CityConfig } from "../../config/types";

const nyc: CityConfig = {
  name: "New York City",
  slug: "nyc",
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
  country: "US",
};

const london: CityConfig = {
  name: "London",
  slug: "london",
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: "Europe/London",
  country: "GB",
};

describe("fetchHrrrForecast (real API)", () => {
  it("returns empty array for non-US cities", async () => {
    const results = await fetchHrrrForecast(london);
    expect(results).toEqual([]);
  });

  it("returns forecasts for NYC with correct shape", async () => {
    const results = await fetchHrrrForecast(nyc);

    expect(results.length).toBeGreaterThanOrEqual(1);

    for (const r of results) {
      expect(r.city).toBe("nyc");
      expect(r.source).toBe("hrrr");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof r.highF).toBe("number");
      expect(r.highF).toBeGreaterThan(-60);
      expect(r.highF).toBeLessThan(150);
      expect(r.weight).toBe(1);
      expect(r.horizonHours).toBe(18);
      expect(r.fetchedAt).toBeTruthy();
    }
  }, 15_000);

  it("respects custom weight", async () => {
    const results = await fetchHrrrForecast(nyc, 3);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].weight).toBe(3);
  }, 15_000);

  it("returns dates starting from today", async () => {
    const results = await fetchHrrrForecast(nyc);
    const today = new Date().toISOString().split("T")[0];

    expect(results.length).toBeGreaterThanOrEqual(1);
    // First date should be today or very close
    expect(results[0].date).toBe(today);
  }, 15_000);
});
