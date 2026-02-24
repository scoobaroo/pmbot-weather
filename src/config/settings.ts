import { CityConfig, EnsembleModelConfig } from "./types";

export const CITIES: CityConfig[] = [
  {
    name: "New York City",
    slug: "nyc",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
    country: "US",
  },
  {
    name: "Chicago",
    slug: "chicago",
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: "America/Chicago",
    country: "US",
  },
  {
    name: "London",
    slug: "london",
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: "Europe/London",
    country: "GB",
  },
  {
    name: "Seoul",
    slug: "seoul",
    latitude: 37.5665,
    longitude: 126.978,
    timezone: "Asia/Seoul",
    country: "KR",
  },
];

export const ENSEMBLE_MODELS: EnsembleModelConfig[] = [
  { name: "GFS", memberCount: 31, apiParam: "gfs_seamless" },
  { name: "ECMWF", memberCount: 51, apiParam: "ecmwf_ifs025" },
  { name: "ICON", memberCount: 40, apiParam: "icon_seamless" },
  { name: "GEM", memberCount: 21, apiParam: "gem_global" },
];

export const TOTAL_ENSEMBLE_MEMBERS = ENSEMBLE_MODELS.reduce(
  (sum, m) => sum + m.memberCount,
  0
);

// City name aliases used in Polymarket titles
export const CITY_ALIASES: Record<string, string> = {
  "new york": "nyc",
  "new york city": "nyc",
  nyc: "nyc",
  chicago: "chicago",
  london: "london",
  seoul: "seoul",
};

// Temperature bucket boundaries commonly used in Polymarket (°F)
export const DEFAULT_BUCKET_WIDTH = 5;
