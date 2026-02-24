import { CityConfig, EnsembleModelConfig } from "../config/types";
import { EnsembleForecast, EnsembleMember } from "./types";
import { childLogger, withRetry } from "../utils";

const log = childLogger("openmeteo");

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    [key: string]: number[] | string[]; // temperature_2m_member00, etc.
  };
}

/**
 * Fetch ensemble forecast from Open-Meteo for a single city and model.
 */
export async function fetchEnsembleForecast(
  baseUrl: string,
  city: CityConfig,
  model: EnsembleModelConfig,
  forecastDays = 7
): Promise<EnsembleForecast> {
  const url = buildUrl(baseUrl, city, model, forecastDays);
  log.debug({ city: city.slug, model: model.name, url }, "Fetching ensemble");

  const data = await withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
      }
      return res.json() as Promise<OpenMeteoResponse>;
    },
    `openmeteo-${city.slug}-${model.name}`
  );

  const members = parseMembers(data, model);
  log.info(
    { city: city.slug, model: model.name, memberCount: members.length },
    "Fetched ensemble"
  );

  return {
    city: city.slug,
    date: new Date().toISOString().split("T")[0],
    model: model.name,
    members,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch all ensemble models for a city.
 */
export async function fetchAllModels(
  baseUrl: string,
  city: CityConfig,
  models: EnsembleModelConfig[]
): Promise<EnsembleForecast[]> {
  const results = await Promise.allSettled(
    models.map((m) => fetchEnsembleForecast(baseUrl, city, m))
  );

  const forecasts: EnsembleForecast[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      forecasts.push(r.value);
    } else {
      log.error(
        { model: models[i].name, city: city.slug, err: r.reason },
        "Failed to fetch model"
      );
    }
  }

  return forecasts;
}

function buildUrl(
  baseUrl: string,
  city: CityConfig,
  model: EnsembleModelConfig,
  forecastDays: number
): string {
  const params = new URLSearchParams({
    latitude: city.latitude.toString(),
    longitude: city.longitude.toString(),
    hourly: "temperature_2m",
    temperature_unit: "fahrenheit",
    timezone: city.timezone,
    forecast_days: forecastDays.toString(),
    models: model.apiParam,
  });
  return `${baseUrl}?${params.toString()}`;
}

function parseMembers(
  data: OpenMeteoResponse,
  model: EnsembleModelConfig
): EnsembleMember[] {
  const members: EnsembleMember[] = [];
  const times = data.hourly.time as string[];

  for (let i = 0; i < model.memberCount; i++) {
    const key = `temperature_2m_member${String(i).padStart(2, "0")}`;
    const temps = data.hourly[key] as number[] | undefined;
    if (!temps) {
      log.warn({ model: model.name, memberIndex: i, key }, "Missing member data");
      continue;
    }
    members.push({
      model: model.name,
      memberIndex: i,
      temperatures: temps,
      times,
    });
  }

  return members;
}
