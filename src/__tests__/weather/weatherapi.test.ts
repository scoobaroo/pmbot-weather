import { fetchWeatherApiForecast } from "../../weather/weatherapi";
import { CityConfig } from "../../config/types";
import { loadConfig } from "../../config/env";

const config = loadConfig();

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

const skipIfNoKey = config.weatherApiKey ? describe : describe.skip;

skipIfNoKey("fetchWeatherApiForecast (real API)", () => {
  it("returns forecasts for NYC with correct shape", async () => {
    const results = await fetchWeatherApiForecast(config.weatherApiKey, nyc, 3);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(3);

    for (const r of results) {
      expect(r.city).toBe("nyc");
      expect(r.source).toBe("weatherapi");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof r.highF).toBe("number");
      expect(r.highF).toBeGreaterThan(-60);
      expect(r.highF).toBeLessThan(150);
      expect(typeof r.lowF).toBe("number");
      expect(typeof r.description).toBe("string");
      expect(r.weight).toBe(1);
      expect(r.fetchedAt).toBeTruthy();
    }
  }, 15_000);

  it("returns forecasts for London (non-US city)", async () => {
    const results = await fetchWeatherApiForecast(config.weatherApiKey, london, 2);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].city).toBe("london");
    expect(typeof results[0].highF).toBe("number");
  }, 15_000);

  it("respects custom weight", async () => {
    const results = await fetchWeatherApiForecast(config.weatherApiKey, nyc, 1, 5);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].weight).toBe(5);
  }, 15_000);
});
