import { CityConfig } from "../config/types";
import { DeterministicForecast } from "./types";
import { childLogger, withRetry } from "../utils";

const log = childLogger("weatherapi");

interface WeatherApiResponse {
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        condition: { text: string };
      };
    }>;
  };
}

/**
 * Fetch deterministic forecast from WeatherAPI.com (3-day, global).
 */
export async function fetchWeatherApiForecast(
  apiKey: string,
  city: CityConfig,
  days = 3,
  weight = 1
): Promise<DeterministicForecast[]> {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city.latitude},${city.longitude}&days=${days}`;
  log.debug({ city: city.slug, url: url.replace(apiKey, "REDACTED") }, "Fetching WeatherAPI");

  const data = await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WeatherAPI ${res.status}: ${await res.text()}`);
    return res.json() as Promise<WeatherApiResponse>;
  }, `weatherapi-${city.slug}`);

  const results: DeterministicForecast[] = data.forecast.forecastday.map((day) => ({
    city: city.slug,
    date: day.date,
    source: "weatherapi",
    highF: day.day.maxtemp_f,
    lowF: day.day.mintemp_f,
    description: day.day.condition.text,
    weight,
    fetchedAt: new Date().toISOString(),
  }));

  log.info({ city: city.slug, days: results.length }, "Fetched WeatherAPI forecast");
  return results;
}
