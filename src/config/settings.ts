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
  {
    name: "Seattle",
    slug: "seattle",
    latitude: 47.6062,
    longitude: -122.3321,
    timezone: "America/Los_Angeles",
    country: "US",
  },
  {
    name: "Dallas",
    slug: "dallas",
    latitude: 32.7767,
    longitude: -96.797,
    timezone: "America/Chicago",
    country: "US",
  },
  {
    name: "Atlanta",
    slug: "atlanta",
    latitude: 33.749,
    longitude: -84.388,
    timezone: "America/New_York",
    country: "US",
  },
  {
    name: "Miami",
    slug: "miami",
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: "America/New_York",
    country: "US",
  },
  {
    name: "Paris",
    slug: "paris",
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: "Europe/Paris",
    country: "FR",
  },
  {
    name: "Sao Paulo",
    slug: "sao-paulo",
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: "America/Sao_Paulo",
    country: "BR",
  },
  {
    name: "Buenos Aires",
    slug: "buenos-aires",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    country: "AR",
  },
  {
    name: "Toronto",
    slug: "toronto",
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: "America/Toronto",
    country: "CA",
  },
  {
    name: "Ankara",
    slug: "ankara",
    latitude: 39.9334,
    longitude: 32.8597,
    timezone: "Europe/Istanbul",
    country: "TR",
  },
  {
    name: "Wellington",
    slug: "wellington",
    latitude: -41.2865,
    longitude: 174.7762,
    timezone: "Pacific/Auckland",
    country: "NZ",
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
  "new york city": "nyc",
  "new york": "nyc",
  nyc: "nyc",
  chicago: "chicago",
  london: "london",
  seoul: "seoul",
  seattle: "seattle",
  dallas: "dallas",
  atlanta: "atlanta",
  miami: "miami",
  paris: "paris",
  "sao paulo": "sao-paulo",
  "são paulo": "sao-paulo",
  "buenos aires": "buenos-aires",
  toronto: "toronto",
  ankara: "ankara",
  wellington: "wellington",
};

// NOAA HRRR model config (via Open-Meteo standard forecast API)
export const HRRR_CONFIG = {
  name: "HRRR",
  apiParam: "ncep_hrrr_conus",
  maxHorizonHours: 18,
  usOnly: true,
} as const;

// Temperature bucket boundaries commonly used in Polymarket (°F)
export const DEFAULT_BUCKET_WIDTH = 5;
