import { CityConfig } from "../config/types";
import { HRRR_CONFIG } from "../config/settings";
import { DeterministicForecast } from "./types";
import { childLogger, withRetry } from "../utils";

const log = childLogger("hrrr");

interface HrrrResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
}

/**
 * Fetch NOAA HRRR forecast via Open-Meteo standard forecast API.
 * US-only, ~18h forecast horizon.
 */
export async function fetchHrrrForecast(
  city: CityConfig,
  weight = 1
): Promise<DeterministicForecast[]> {
  if (city.country !== "US") {
    log.debug({ city: city.slug }, "Skipping HRRR for non-US city");
    return [];
  }

  const params = new URLSearchParams({
    latitude: city.latitude.toString(),
    longitude: city.longitude.toString(),
    hourly: "temperature_2m",
    temperature_unit: "fahrenheit",
    timezone: city.timezone,
    forecast_days: "2",
    models: HRRR_CONFIG.apiParam,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  log.debug({ city: city.slug, url }, "Fetching HRRR");

  const data = await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HRRR ${res.status}: ${await res.text()}`);
    return res.json() as Promise<HrrrResponse>;
  }, `hrrr-${city.slug}`);

  // Group hourly temps by date and extract daily high
  const dailyHighs = new Map<string, number>();
  for (let i = 0; i < data.hourly.time.length; i++) {
    const date = data.hourly.time[i].split("T")[0];
    const temp = data.hourly.temperature_2m[i];
    if (temp == null) continue;
    const current = dailyHighs.get(date) ?? -Infinity;
    if (temp > current) dailyHighs.set(date, temp);
  }

  const results: DeterministicForecast[] = [];
  for (const [date, highF] of dailyHighs) {
    results.push({
      city: city.slug,
      date,
      source: "hrrr",
      highF,
      weight,
      fetchedAt: new Date().toISOString(),
      horizonHours: HRRR_CONFIG.maxHorizonHours,
    });
  }

  log.info({ city: city.slug, days: results.length }, "Fetched HRRR forecast");
  return results;
}
