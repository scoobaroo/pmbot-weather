import { CityConfig } from "../config/types";
import { DeterministicForecast, ObservedConditions } from "./types";
import { childLogger, withRetry, currentHourInTz } from "../utils";

const log = childLogger("weatherapi");

interface WeatherApiResponse {
  current?: {
    temp_f: number;
  };
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

/**
 * Fetch current observed conditions from WeatherAPI.com.
 * Returns the running observed high for today and current temp.
 */
export async function fetchObservedConditions(
  apiKey: string,
  city: CityConfig
): Promise<ObservedConditions> {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city.latitude},${city.longitude}&days=1`;
  log.debug({ city: city.slug }, "Fetching observed conditions");

  const data = await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WeatherAPI ${res.status}: ${await res.text()}`);
    return res.json() as Promise<WeatherApiResponse>;
  }, `weatherapi-observed-${city.slug}`);

  const today = data.forecast.forecastday[0];
  const localHour = currentHourInTz(city.timezone);

  // maxtemp_f is the forecast max, not running observed max.
  // Use the higher of current temp and forecast max as the true floor.
  const currentTemp = data.current?.temp_f ?? today.day.maxtemp_f;
  const observedHigh = Math.max(currentTemp, today.day.maxtemp_f);

  const result: ObservedConditions = {
    city: city.slug,
    currentTempF: currentTemp,
    observedHighF: observedHigh,
    localHour,
    fetchedAt: new Date().toISOString(),
  };

  log.info(
    { city: city.slug, observedHighF: result.observedHighF, currentTempF: result.currentTempF, localHour },
    "Fetched observed conditions"
  );

  return result;
}
