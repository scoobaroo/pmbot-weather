import { WeatherStrategy, TradeSignal } from '../strategy/weatherStrategy';
import { WeatherService, WeatherForecast } from '../weather/weatherService';
import { PolymarketClient, Market } from '../market/polymarketClient';

jest.mock('../weather/weatherService');
jest.mock('../market/polymarketClient');

const MockWeatherService = WeatherService as jest.MockedClass<typeof WeatherService>;
const MockPolymarketClient = PolymarketClient as jest.MockedClass<typeof PolymarketClient>;

const makeForecast = (overrides: Partial<WeatherForecast['forecasts'][0]> = {}): WeatherForecast => ({
  location: 'New York',
  forecasts: [
    {
      date: new Date('2026-02-24'),
      minTemp: 5,
      maxTemp: 15,
      precipitationChance: 0.2,
      description: 'partly cloudy',
      ...overrides,
    },
  ],
});

const makeMarket = (overrides: Partial<Market> = {}): Market => ({
  id: 'market-1',
  question: 'Will it rain in New York this week?',
  conditionId: 'cond-1',
  outcomes: ['Yes', 'No'],
  outcomePrices: [0.4, 0.6],
  volume: 10000,
  active: true,
  closed: false,
  ...overrides,
});

describe('WeatherStrategy', () => {
  let weatherService: jest.Mocked<WeatherService>;
  let polymarketClient: jest.Mocked<PolymarketClient>;
  let strategy: WeatherStrategy;

  beforeEach(() => {
    weatherService = new MockWeatherService('', '') as jest.Mocked<WeatherService>;
    polymarketClient = new MockPolymarketClient('', '') as jest.Mocked<PolymarketClient>;

    strategy = new WeatherStrategy(weatherService, polymarketClient, {
      locations: ['New York'],
      minConfidence: 0.5,
      maxPositionSizeUsd: 100,
    });
  });

  describe('analyzeMarket', () => {
    it('returns null when location does not match', () => {
      const market = makeMarket({ question: 'Will it rain in London this week?' });
      const forecast = makeForecast();

      const result = strategy.analyzeMarket(market, forecast, 'New York');

      expect(result).toBeNull();
    });

    it('detects precipitation signal when rain chance is high', () => {
      const market = makeMarket();
      const forecast = makeForecast({ precipitationChance: 0.8 });

      const result = strategy.analyzeMarket(market, forecast, 'New York');

      expect(result).not.toBeNull();
      expect(result!.side).toBe('BUY');
      expect(result!.outcomeIndex).toBe(0);
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it('detects no-rain signal when rain chance is low', () => {
      const market = makeMarket();
      const forecast = makeForecast({ precipitationChance: 0.1 });

      const result = strategy.analyzeMarket(market, forecast, 'New York');

      expect(result).not.toBeNull();
      expect(result!.side).toBe('BUY');
      expect(result!.outcomeIndex).toBe(1);
    });

    it('detects temperature above threshold signal', () => {
      const market = makeMarket({
        question: 'Will temperature in New York be above 10 degrees?',
        outcomePrices: [0.7, 0.3],
      });
      const forecast = makeForecast({ maxTemp: 20 });

      const result = strategy.analyzeMarket(market, forecast, 'New York');

      expect(result).not.toBeNull();
      expect(result!.side).toBe('BUY');
      expect(result!.outcomeIndex).toBe(0);
    });

    it('detects temperature below threshold signal', () => {
      const market = makeMarket({
        question: 'Will temperature in New York be above 25 degrees?',
        outcomePrices: [0.2, 0.8],
      });
      const forecast = makeForecast({ maxTemp: 10 });

      const result = strategy.analyzeMarket(market, forecast, 'New York');

      expect(result).not.toBeNull();
      expect(result!.side).toBe('BUY');
      expect(result!.outcomeIndex).toBe(1);
    });
  });

  describe('findTradeSignals', () => {
    it('returns signals above minConfidence threshold', async () => {
      const market = makeMarket();
      polymarketClient.getMarkets.mockResolvedValue([market]);
      weatherService.getForecast.mockResolvedValue(makeForecast({ precipitationChance: 0.9 }));

      strategy = new WeatherStrategy(weatherService, polymarketClient, {
        locations: ['New York'],
        minConfidence: 0.7,
        maxPositionSizeUsd: 100,
      });

      const signals = await strategy.findTradeSignals();

      expect(signals.length).toBeGreaterThan(0);
      signals.forEach((s: TradeSignal) => {
        expect(s.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('filters out markets that are not active', async () => {
      const closedMarket = makeMarket({ active: false });
      polymarketClient.getMarkets.mockResolvedValue([closedMarket]);
      weatherService.getForecast.mockResolvedValue(makeForecast({ precipitationChance: 0.9 }));

      const signals = await strategy.findTradeSignals();

      expect(signals).toHaveLength(0);
    });

    it('filters out signals below minConfidence', async () => {
      const market = makeMarket();
      polymarketClient.getMarkets.mockResolvedValue([market]);
      weatherService.getForecast.mockResolvedValue(makeForecast({ precipitationChance: 0.51 }));

      strategy = new WeatherStrategy(weatherService, polymarketClient, {
        locations: ['New York'],
        minConfidence: 0.9,
        maxPositionSizeUsd: 100,
      });

      const signals = await strategy.findTradeSignals();

      expect(signals).toHaveLength(0);
    });
  });
});
