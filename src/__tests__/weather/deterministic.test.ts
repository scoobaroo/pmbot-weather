import { fetchDeterministicForecasts } from "../../weather/deterministic";
import { loadConfig } from "../../config/env";
import { CityConfig } from "../../config/types";
import { todayInTz, tomorrowInTz } from "../../utils";

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

describe("fetchDeterministicForecasts (real API)", () => {
  const today = todayInTz(nyc.timezone);
  const tomorrow = tomorrowInTz(nyc.timezone);
  const targetDates = [today, tomorrow];

  it("fetches multiple sources for a US city", async () => {
    const testConfig = { ...config, enableHrrr: true };
    const results = await fetchDeterministicForecasts(testConfig, nyc, targetDates);

    expect(results.length).toBeGreaterThanOrEqual(1);

    const sources = [...new Set(results.map((r) => r.source))];
    // At minimum NWS and HRRR should work for US cities (no key needed)
    expect(sources).toContain("nws");
    expect(sources).toContain("hrrr");

    for (const r of results) {
      expect(typeof r.highF).toBe("number");
      expect(r.highF).toBeGreaterThan(-60);
      expect(r.highF).toBeLessThan(150);
      expect(r.weight).toBe(config.deterministicWeight);
    }
  }, 30_000);

  it("includes WeatherAPI when key is set", async () => {
    if (!config.weatherApiKey) return;

    const results = await fetchDeterministicForecasts(config, nyc, targetDates);
    const sources = [...new Set(results.map((r) => r.source))];
    expect(sources).toContain("weatherapi");
  }, 30_000);

  it("skips HRRR for non-US cities", async () => {
    const testConfig = { ...config, enableHrrr: true };
    const londonToday = todayInTz(london.timezone);
    const results = await fetchDeterministicForecasts(testConfig, london, [londonToday]);

    const sources = [...new Set(results.map((r) => r.source))];
    expect(sources).not.toContain("hrrr");
    expect(sources).not.toContain("nws");
  }, 30_000);

  it("skips WeatherAPI when key is empty", async () => {
    const testConfig = { ...config, weatherApiKey: "" };
    const results = await fetchDeterministicForecasts(testConfig, london, [todayInTz(london.timezone)]);

    const sources = [...new Set(results.map((r) => r.source))];
    expect(sources).not.toContain("weatherapi");
  }, 30_000);

  it("skips HRRR when disabled", async () => {
    const testConfig = { ...config, enableHrrr: false };
    const results = await fetchDeterministicForecasts(testConfig, nyc, targetDates);

    const sources = [...new Set(results.map((r) => r.source))];
    expect(sources).not.toContain("hrrr");
  }, 30_000);
});
