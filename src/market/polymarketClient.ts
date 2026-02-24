import axios from 'axios';

export interface Market {
  id: string;
  question: string;
  conditionId: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  active: boolean;
  closed: boolean;
}

export interface OrderResult {
  orderId: string;
  status: string;
  filledAmount: number;
  price: number;
}

export class PolymarketClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getMarkets(keyword: string): Promise<Market[]> {
    const response = await axios.get(`${this.baseUrl}/markets`, {
      params: { keyword },
      headers: this.buildHeaders(),
    });

    return response.data.data ?? [];
  }

  async getMarket(conditionId: string): Promise<Market> {
    const response = await axios.get(`${this.baseUrl}/markets/${conditionId}`, {
      headers: this.buildHeaders(),
    });

    return response.data;
  }

  async placeLimitOrder(
    conditionId: string,
    outcomeIndex: number,
    side: 'BUY' | 'SELL',
    price: number,
    sizeUsd: number
  ): Promise<OrderResult> {
    const response = await axios.post(
      `${this.baseUrl}/order`,
      {
        condition_id: conditionId,
        token_id: outcomeIndex,
        side,
        price,
        size: sizeUsd,
        type: 'GTC',
      },
      { headers: this.buildHeaders() }
    );

    return response.data;
  }

  async cancelOrder(orderId: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/orders/${orderId}`, {
      headers: this.buildHeaders(),
    });
  }

  async getOpenOrders(): Promise<OrderResult[]> {
    const response = await axios.get(`${this.baseUrl}/orders`, {
      params: { status: 'open' },
      headers: this.buildHeaders(),
    });

    return response.data.data ?? [];
  }

  private buildHeaders(): Record<string, string> {
    return {
      'POLY-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }
}
