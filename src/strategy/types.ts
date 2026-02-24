export interface EdgeResult {
  tokenId: string;
  conditionId: string;
  city: string;
  date: string;
  bucketLabel: string;
  forecastProb: number;
  marketPrice: number;
  edge: number;          // forecastProb - marketPrice
  side: "YES" | "NO";
}

export interface TradeSignal {
  tokenId: string;
  conditionId: string;
  city: string;
  date: string;
  bucketLabel: string;
  side: "YES" | "NO";
  edge: number;
  forecastProb: number;
  marketPrice: number;
  sizeUsd: number;
  kellyFraction: number;
  confidence: number; // 0-1 based on ensemble agreement
}
