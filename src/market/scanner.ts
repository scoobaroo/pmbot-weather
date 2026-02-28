import { WeatherEvent, WeatherMarket } from "./types";
import { parseMarketTitle } from "./parser";
import { childLogger, withRetry } from "../utils";

const log = childLogger("scanner");

/** Gamma API "Daily Temperature" tag ID. */
const TEMPERATURE_TAG_ID = "103040";

interface GammaMarket {
  conditionId: string;
  question: string;
  clobTokenIds: string; // JSON array string: '["yesTokenId", "noTokenId"]'
  outcomePrices: string; // JSON array string: '["0.35", "0.65"]'
  closed: boolean;
  active: boolean;
  acceptingOrders: boolean;
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  endDate: string;
  active: boolean;
  markets: GammaMarket[];
}

/**
 * Scan Gamma API for active weather/temperature events using tag_id filter.
 */
export async function scanWeatherMarkets(
  gammaApiUrl: string
): Promise<WeatherEvent[]> {
  const events = await fetchTemperatureEvents(gammaApiUrl);
  log.info({ rawEvents: events.length }, "Found temperature events on Gamma");

  const weatherEvents: WeatherEvent[] = [];

  for (const event of events) {
    const markets = parseEventMarkets(event);
    if (markets.length > 0) {
      weatherEvents.push({
        conditionId: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description || "",
        endDate: event.endDate,
        active: event.active,
        markets,
      });
    }
  }

  log.info(
    {
      events: weatherEvents.length,
      totalMarkets: weatherEvents.reduce((s, e) => s + e.markets.length, 0),
    },
    "Parsed weather markets"
  );

  return weatherEvents;
}

async function fetchTemperatureEvents(gammaApiUrl: string): Promise<GammaEvent[]> {
  const allEvents: GammaEvent[] = [];
  let offset = 0;
  const limit = 100;

  // Paginate through temperature-tagged events
  while (true) {
    try {
      const events = await withRetry(async () => {
        const url = `${gammaApiUrl}/events?tag_id=${TEMPERATURE_TAG_ID}&active=true&closed=false&limit=${limit}&offset=${offset}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gamma API ${res.status}`);
        return res.json() as Promise<GammaEvent[]>;
      }, "gamma-temperature");

      const eventArray: GammaEvent[] = Array.isArray(events) ? events : [];
      if (eventArray.length === 0) break;

      allEvents.push(...eventArray);
      offset += limit;

      // Safety: don't paginate beyond reasonable bounds
      if (offset >= 1000) break;
    } catch (err) {
      log.warn({ err, offset }, "Failed to fetch temperature events");
      break;
    }
  }

  return allEvents;
}

function parseEventMarkets(event: GammaEvent): WeatherMarket[] {
  const markets: WeatherMarket[] = [];

  for (const m of event.markets || []) {
    // Skip markets that aren't accepting orders
    if (!m.acceptingOrders) continue;

    const parsed = parseMarketTitle(m.question || event.title);
    if (!parsed) continue;

    // Parse clobTokenIds — JSON array ["yesTokenId", "noTokenId"]
    let yesTokenId: string;
    try {
      const tokenIds: string[] = JSON.parse(m.clobTokenIds || "[]");
      if (tokenIds.length === 0) continue;
      yesTokenId = tokenIds[0]; // First token is Yes
    } catch {
      log.warn({ question: m.question }, "Failed to parse clobTokenIds — skipping");
      continue;
    }

    // Parse outcomePrices — JSON array ["yesPrice", "noPrice"]
    let price: number;
    try {
      const prices: string[] = JSON.parse(m.outcomePrices || "[]");
      price = parseFloat(prices[0]);
    } catch {
      log.warn({ question: m.question }, "Failed to parse outcomePrices — skipping");
      continue;
    }
    if (isNaN(price) || price <= 0 || price >= 1) continue;

    markets.push({
      conditionId: m.conditionId,
      tokenId: yesTokenId,
      outcome: "Yes",
      price,
      question: m.question || event.title,
      city: parsed.city,
      date: parsed.date,
      bucketLower: parsed.bucketLower,
      bucketUpper: parsed.bucketUpper,
      bucketLabel: parsed.bucketLabel,
      unit: parsed.unit,
    });
  }

  return markets;
}
