import { WeatherService, WeatherForecast } from '../weather/weatherService';
import { PolymarketClient, Market } from '../market/polymarketClient';

export interface TradeSignal {
  marketId: string;
  question: string;
  outcomeIndex: number;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  reasoning: string;
}

export interface StrategyConfig {
  locations: string[];
  minConfidence: number;
  maxPositionSizeUsd: number;
}

export class WeatherStrategy {
  private readonly weatherService: WeatherService;
  private readonly polymarketClient: PolymarketClient;
  private readonly config: StrategyConfig;

  constructor(
    weatherService: WeatherService,
    polymarketClient: PolymarketClient,
    config: StrategyConfig
  ) {
    this.weatherService = weatherService;
    this.polymarketClient = polymarketClient;
    this.config = config;
  }

  async findTradeSignals(): Promise<TradeSignal[]> {
    const signals: TradeSignal[] = [];

    const markets = await this.polymarketClient.getMarkets('weather');
    const activeMarkets = markets.filter((m) => m.active && !m.closed);

    for (const location of this.config.locations) {
      const forecast = await this.weatherService.getForecast(location, 5);

      for (const market of activeMarkets) {
        const signal = this.analyzeMarket(market, forecast, location);
        if (signal && signal.confidence >= this.config.minConfidence) {
          signals.push(signal);
        }
      }
    }

    return signals;
  }

  analyzeMarket(
    market: Market,
    forecast: WeatherForecast,
    location: string
  ): TradeSignal | null {
    const question = market.question.toLowerCase();

    if (!question.includes(location.toLowerCase())) {
      return null;
    }

    const signal = this.detectTemperatureSignal(market, forecast);
    if (signal) return signal;

    return this.detectPrecipitationSignal(market, forecast);
  }

  private detectTemperatureSignal(
    market: Market,
    forecast: WeatherForecast
  ): TradeSignal | null {
    const question = market.question.toLowerCase();
    const tempMatch = question.match(/above\s+([\d.]+)\s*(?:°|degrees|°f|°c)?/);

    if (!tempMatch) return null;

    const threshold = parseFloat(tempMatch[1]);
    const avgMaxTemp =
      forecast.forecasts.reduce((sum, f) => sum + f.maxTemp, 0) /
      forecast.forecasts.length;

    const margin = Math.abs(avgMaxTemp - threshold);
    const confidence = Math.min(0.5 + margin / 20, 0.95);

    if (avgMaxTemp > threshold) {
      return {
        marketId: market.id,
        question: market.question,
        outcomeIndex: 0,
        outcome: market.outcomes[0],
        side: 'BUY',
        price: market.outcomePrices[0],
        confidence,
        reasoning: `Avg max temp ${avgMaxTemp.toFixed(1)}° exceeds threshold ${threshold}°`,
      };
    }

    return {
      marketId: market.id,
      question: market.question,
      outcomeIndex: 1,
      outcome: market.outcomes[1],
      side: 'BUY',
      price: market.outcomePrices[1],
      confidence,
      reasoning: `Avg max temp ${avgMaxTemp.toFixed(1)}° is below threshold ${threshold}°`,
    };
  }

  private detectPrecipitationSignal(
    market: Market,
    forecast: WeatherForecast
  ): TradeSignal | null {
    const question = market.question.toLowerCase();
    const willRain =
      question.includes('rain') ||
      question.includes('precipitation') ||
      question.includes('snow');

    if (!willRain) return null;

    const maxPrecipChance = Math.max(
      ...forecast.forecasts.map((f) => f.precipitationChance)
    );

    const confidence = Math.abs(maxPrecipChance - 0.5) + 0.5;

    if (maxPrecipChance > 0.5) {
      return {
        marketId: market.id,
        question: market.question,
        outcomeIndex: 0,
        outcome: market.outcomes[0],
        side: 'BUY',
        price: market.outcomePrices[0],
        confidence,
        reasoning: `Max precipitation chance ${(maxPrecipChance * 100).toFixed(0)}%`,
      };
    }

    return {
      marketId: market.id,
      question: market.question,
      outcomeIndex: 1,
      outcome: market.outcomes[1],
      side: 'BUY',
      price: market.outcomePrices[1],
      confidence,
      reasoning: `Low precipitation chance ${(maxPrecipChance * 100).toFixed(0)}%`,
    };
  }
}
