import { CityConfig } from "../config/types";
import { NwsForecast } from "./types";
import { childLogger, withRetry } from "../utils";

const log = childLogger("nws");

interface NwsPointsResponse {
  properties: {
    forecast: string;
  };
}

interface NwsForecastResponse {
  properties: {
    periods: Array<{
      name: string;
      startTime: string;
      temperature: number;
      temperatureUnit: string;
      shortForecast: string;
      isDaytime: boolean;
    }>;
  };
}

/**
 * Fetch NWS forecast for US cities as a validation/backup source.
 * NWS only covers US cities (NYC, Chicago).
 */
export async function fetchNwsForecast(
  baseUrl: string,
  city: CityConfig
): Promise<NwsForecast[]> {
  if (city.country !== "US") {
    log.debug({ city: city.slug }, "Skipping NWS for non-US city");
    return [];
  }

  const pointsUrl = `${baseUrl}/points/${city.latitude},${city.longitude}`;

  const points = await withRetry(async () => {
    const res = await fetch(pointsUrl, {
      headers: { "User-Agent": "pmbot-weather/1.0" },
    });
    if (!res.ok) throw new Error(`NWS points ${res.status}`);
    return res.json() as Promise<NwsPointsResponse>;
  }, `nws-points-${city.slug}`);

  const forecastUrl = points.properties.forecast;

  const forecast = await withRetry(async () => {
    const res = await fetch(forecastUrl, {
      headers: { "User-Agent": "pmbot-weather/1.0" },
    });
    if (!res.ok) throw new Error(`NWS forecast ${res.status}`);
    return res.json() as Promise<NwsForecastResponse>;
  }, `nws-forecast-${city.slug}`);

  const results: NwsForecast[] = [];
  const periods = forecast.properties.periods;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (!p.isDaytime) continue;

    const date = p.startTime.split("T")[0];
    // Find the corresponding night period for the low
    const nightPeriod = periods[i + 1];
    const lowF = nightPeriod && !nightPeriod.isDaytime ? nightPeriod.temperature : 0;

    let highF = p.temperature;
    // Convert if Celsius
    if (p.temperatureUnit === "C") {
      highF = (highF * 9) / 5 + 32;
    }

    results.push({
      city: city.slug,
      date,
      highF,
      lowF: p.temperatureUnit === "C" ? (lowF * 9) / 5 + 32 : lowF,
      description: p.shortForecast,
    });
  }

  log.info({ city: city.slug, periods: results.length }, "Fetched NWS forecast");
  return results;
}
