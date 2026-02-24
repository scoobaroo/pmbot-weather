import { CITY_ALIASES } from "../config/settings";
import { parseMarketDate } from "../utils/time";

export interface ParsedMarket {
  city: string;       // normalized slug e.g. "nyc"
  date: string;       // YYYY-MM-DD
  metric: "high" | "low";
  bucketLower: number | null;
  bucketUpper: number | null;
  bucketLabel: string;
}

/**
 * Parse a Polymarket weather question into structured data.
 *
 * Examples:
 *   "Will the high temperature in NYC on February 25 be between 40°F and 44°F?"
 *   "Highest temperature in New York City on February 25?"
 *   "Will the high temperature in Chicago on Feb 26 be 50°F or higher?"
 *   "Will the high temperature in Seoul on March 1 be below 35°F?"
 */
export function parseMarketTitle(title: string): ParsedMarket | null {
  const lower = title.toLowerCase();

  // Extract city
  const city = extractCity(lower);
  if (!city) return null;

  // Extract date
  const date = extractDate(title);
  if (!date) return null;

  // Determine metric (high vs low)
  const metric = /\blow\s+temperature\b/.test(lower) ? "low" : "high";

  // Extract temperature bucket
  const bucket = extractBucket(title);
  if (!bucket) return null;

  return {
    city,
    date,
    metric,
    ...bucket,
  };
}

function extractCity(lower: string): string | null {
  // Check all known aliases, longest first to avoid partial matches
  const aliases = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (lower.includes(alias)) {
      return CITY_ALIASES[alias];
    }
  }
  return null;
}

function extractDate(title: string): string | null {
  // Match "on <month> <day>" or "on <m>/<d>"
  const onDateMatch = title.match(
    /on\s+((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\/\d{1,2})/i
  );
  if (onDateMatch) {
    return parseMarketDate(onDateMatch[1]);
  }

  // Match standalone date anywhere
  const monthDayMatch = title.match(
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i
  );
  if (monthDayMatch) {
    return parseMarketDate(monthDayMatch[1]);
  }

  return null;
}

interface BucketResult {
  bucketLower: number | null;
  bucketUpper: number | null;
  bucketLabel: string;
}

function extractBucket(title: string): BucketResult | null {
  // "between X°F and Y°F" or "X°F to Y°F" or "X-Y°F"
  const rangeMatch = title.match(
    /(?:between\s+)?(-?\d+)\s*°?\s*F?\s*(?:and|to|-)\s*(-?\d+)\s*°?\s*F/i
  );
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    return {
      bucketLower: low,
      bucketUpper: high,
      bucketLabel: `${low}-${high}°F`,
    };
  }

  // "X°F or higher" / "at least X°F" / "above X°F"
  const higherMatch = title.match(
    /(-?\d+)\s*°?\s*F?\s*or\s+(?:higher|more|above)|(?:at\s+least|above|over)\s+(-?\d+)\s*°?\s*F/i
  );
  if (higherMatch) {
    const val = parseInt(higherMatch[1] || higherMatch[2], 10);
    return {
      bucketLower: val,
      bucketUpper: null,
      bucketLabel: `${val}°F or higher`,
    };
  }

  // "X°F or lower" / "below X°F" / "under X°F"
  const lowerMatch = title.match(
    /(-?\d+)\s*°?\s*F?\s*or\s+(?:lower|less|below)|(?:below|under)\s+(-?\d+)\s*°?\s*F/i
  );
  if (lowerMatch) {
    const val = parseInt(lowerMatch[1] || lowerMatch[2], 10);
    return {
      bucketLower: null,
      bucketUpper: val,
      bucketLabel: `${val}°F or lower`,
    };
  }

  return null;
}
