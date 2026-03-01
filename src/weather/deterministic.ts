import { AppConfig, CityConfig } from "../config/types";
import { DeterministicForecast, ObservedConditions } from "./types";
import { fetchNwsForecast } from "./nws";
import { fetchWeatherApiForecast, fetchObservedConditions } from "./weatherapi";
import { fetchHrrrForecast } from "./hrrr";
import { childLogger } from "../utils";

const log = childLogger("deterministic");

/**
 * Fetch all available deterministic forecasts for a city.
 * Each source is independent — failures are caught and logged, not propagated.
 */
export async function fetchDeterministicForecasts(
  config: AppConfig,
  city: CityConfig,
  targetDates: string[]
): Promise<DeterministicForecast[]> {
  const weight = config.deterministicWeight;
  const promises: Promise<DeterministicForecast[]>[] = [];

  // NWS (US only, no key needed)
  promises.push(
    fetchNwsForecast(config.nwsBaseUrl, city, weight).catch((err) => {
      log.warn({ err, city: city.slug, source: "nws" }, "Deterministic fetch failed");
      return [] as DeterministicForecast[];
    })
  );

  // WeatherAPI.com (key required)
  if (config.weatherApiKey) {
    promises.push(
      fetchWeatherApiForecast(config.weatherApiKey, city, 3, weight).catch((err) => {
        log.warn({ err, city: city.slug, source: "weatherapi" }, "Deterministic fetch failed");
        return [] as DeterministicForecast[];
      })
    );
  }

  // NOAA HRRR (US only, no key needed)
  if (config.enableHrrr) {
    promises.push(
      fetchHrrrForecast(city, weight).catch((err) => {
        log.warn({ err, city: city.slug, source: "hrrr" }, "Deterministic fetch failed");
        return [] as DeterministicForecast[];
      })
    );
  }

  const results = await Promise.all(promises);
  const all = results.flat();

  log.info(
    {
      city: city.slug,
      sources: [...new Set(all.map((f) => f.source))],
      count: all.length,
    },
    "Fetched deterministic forecasts"
  );

  return all;
}

/**
 * Fetch observed conditions for a city. Returns null if unavailable.
 */
export async function fetchObserved(
  config: AppConfig,
  city: CityConfig
): Promise<ObservedConditions | null> {
  if (!config.weatherApiKey) return null;

  try {
    return await fetchObservedConditions(config.weatherApiKey, city);
  } catch (err) {
    log.warn({ err, city: city.slug }, "Failed to fetch observed conditions");
    return null;
  }
}
