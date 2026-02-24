export interface WeatherEvent {
  conditionId: string;
  slug: string;
  title: string;
  description: string;
  endDate: string;
  active: boolean;
  markets: WeatherMarket[];
}

export interface WeatherMarket {
  conditionId: string;
  tokenId: string;        // CLOB token ID
  outcome: string;        // "Yes" or "No"
  price: number;          // 0-1 (best ask for Yes)
  question: string;       // full market question
  city: string;
  date: string;           // YYYY-MM-DD
  bucketLower: number | null;
  bucketUpper: number | null;
  bucketLabel: string;
}

export interface OrderBookEntry {
  price: number;
  size: number;
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  bestBid: number;
  bestAsk: number;
  spread: number;
}
