import axios from 'axios';

export interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  timestamp: Date;
}

export interface WeatherForecast {
  location: string;
  forecasts: Array<{
    date: Date;
    minTemp: number;
    maxTemp: number;
    precipitationChance: number;
    description: string;
  }>;
}

export class WeatherService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getCurrentWeather(location: string): Promise<WeatherData> {
    const response = await axios.get(`${this.baseUrl}/weather`, {
      params: {
        q: location,
        appid: this.apiKey,
        units: 'metric',
      },
    });

    const data = response.data;
    return {
      location,
      temperature: data.main.temp,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      description: data.weather[0].description,
      timestamp: new Date(),
    };
  }

  async getForecast(location: string, days: number = 5): Promise<WeatherForecast> {
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        q: location,
        appid: this.apiKey,
        units: 'metric',
        cnt: days * 8, // API returns data every 3 hours
      },
    });

    const data = response.data;
    const dailyForecasts = this.aggregateDailyForecasts(data.list);

    return {
      location,
      forecasts: dailyForecasts.slice(0, days),
    };
  }

  private aggregateDailyForecasts(
    list: Array<{
      dt_txt: string;
      main: { temp_min: number; temp_max: number };
      pop: number;
      weather: Array<{ description: string }>;
    }>
  ): WeatherForecast['forecasts'] {
    const byDay = new Map<
      string,
      {
        minTemp: number;
        maxTemp: number;
        precipChances: number[];
        descriptions: string[];
      }
    >();

    for (const item of list) {
      const day = item.dt_txt.split(' ')[0];
      const existing = byDay.get(day);

      if (!existing) {
        byDay.set(day, {
          minTemp: item.main.temp_min,
          maxTemp: item.main.temp_max,
          precipChances: [item.pop],
          descriptions: [item.weather[0].description],
        });
      } else {
        existing.minTemp = Math.min(existing.minTemp, item.main.temp_min);
        existing.maxTemp = Math.max(existing.maxTemp, item.main.temp_max);
        existing.precipChances.push(item.pop);
        existing.descriptions.push(item.weather[0].description);
      }
    }

    return Array.from(byDay.entries()).map(([day, data]) => ({
      date: new Date(day),
      minTemp: data.minTemp,
      maxTemp: data.maxTemp,
      precipitationChance: Math.max(...data.precipChances),
      description: data.descriptions[Math.floor(data.descriptions.length / 2)],
    }));
  }
}
