export interface EnsembleMember {
  model: string;
  memberIndex: number;
  temperatures: number[]; // hourly temps in °F
  times: string[];        // ISO timestamps
}

export interface EnsembleForecast {
  city: string;
  date: string; // YYYY-MM-DD
  model: string;
  members: EnsembleMember[];
  fetchedAt: string;
}

export interface AggregatedForecast {
  city: string;
  date: string;
  totalMembers: number;
  highTemps: number[]; // daily high from each member
  mean: number;
  stdDev: number;
  bucketProbabilities: BucketProbability[];
}

export interface BucketProbability {
  lower: number | null; // null = unbounded below
  upper: number | null; // null = unbounded above
  label: string;        // e.g. "50°F or lower", "51-55°F"
  probability: number;  // 0-1
}

export interface DeterministicForecast {
  city: string;
  date: string;
  source: string;
  highF: number;
  lowF?: number;
  description?: string;
  weight: number;
  fetchedAt: string;
  horizonHours?: number;
}

/** @deprecated Use DeterministicForecast instead */
export type NwsForecast = DeterministicForecast;
