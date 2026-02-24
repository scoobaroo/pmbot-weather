import { WeatherEvent, WeatherMarket } from "./types";
import { parseMarketTitle } from "./parser";
import { childLogger, withRetry } from "../utils";

const log = childLogger("scanner");

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  endDate: string;
  active: boolean;
  markets: Array<{
    id: string;
    conditionId: string;
    question: string;
    tokens: Array<{
      token_id: string;
      outcome: string;
    }>;
    outcomePrices: string; // JSON string of [yesPrice, noPrice]
  }>;
}

interface GammaResponse {
  data?: GammaEvent[];
  // Sometimes it's a direct array
  [index: number]: GammaEvent;
}

/**
 * Scan Gamma API for active weather/temperature markets.
 */
export async function scanWeatherMarkets(
  gammaApiUrl: string
): Promise<WeatherEvent[]> {
  const events = await fetchWeatherEvents(gammaApiUrl);
  log.info({ rawEvents: events.length }, "Found weather events on Gamma");

  const weatherEvents: WeatherEvent[] = [];

  for (const event of events) {
    const markets = parseEventMarkets(event);
    if (markets.length > 0) {
      weatherEvents.push({
        conditionId: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
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

async function fetchWeatherEvents(gammaApiUrl: string): Promise<GammaEvent[]> {
  // Search for temperature-related events
  const searchTerms = ["temperature", "weather", "high temp"];
  const allEvents: Map<string, GammaEvent> = new Map();

  for (const term of searchTerms) {
    try {
      const events = await withRetry(async () => {
        const url = `${gammaApiUrl}/events?tag=temperature&active=true&closed=false&limit=50`;
        const res = await fetch(url);
        if (!res.ok) {
          // Try alternative search
          const altUrl = `${gammaApiUrl}/events?title_contains=${encodeURIComponent(term)}&active=true&closed=false&limit=50`;
          const altRes = await fetch(altUrl);
          if (!altRes.ok) throw new Error(`Gamma API ${altRes.status}`);
          return altRes.json();
        }
        return res.json();
      }, `gamma-search-${term}`);

      const eventArray: GammaEvent[] = Array.isArray(events) ? events : (events as GammaResponse).data || [];
      for (const e of eventArray) {
        if (e.id) allEvents.set(e.id, e);
      }
    } catch (err) {
      log.warn({ term, err }, "Failed to search Gamma");
    }
  }

  return Array.from(allEvents.values());
}

function parseEventMarkets(event: GammaEvent): WeatherMarket[] {
  const markets: WeatherMarket[] = [];

  for (const m of event.markets || []) {
    const parsed = parseMarketTitle(m.question || event.title);
    if (!parsed) continue;

    // Get Yes token
    const yesToken = m.tokens?.find((t) => t.outcome === "Yes");
    if (!yesToken) continue;

    // Parse prices
    let price = 0.5;
    try {
      const prices = JSON.parse(m.outcomePrices || "[]");
      if (prices[0]) price = parseFloat(prices[0]);
    } catch {
      // use default
    }

    markets.push({
      conditionId: m.conditionId || m.id,
      tokenId: yesToken.token_id,
      outcome: "Yes",
      price,
      question: m.question || event.title,
      city: parsed.city,
      date: parsed.date,
      bucketLower: parsed.bucketLower,
      bucketUpper: parsed.bucketUpper,
      bucketLabel: parsed.bucketLabel,
    });
  }

  return markets;
}
