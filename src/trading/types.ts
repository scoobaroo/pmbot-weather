export interface OrderRequest {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number; // in USDC
  type: "GTC" | "FOK" | "GTD";
}

export interface ExecutionResult {
  orderId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  status: "PLACED" | "FILLED" | "PARTIAL" | "FAILED" | "DRY_RUN";
  timestamp: string;
  error?: string;
}

export interface Position {
  tokenId: string;
  conditionId: string;
  city: string;
  date: string;
  bucketLabel: string;
  side: "YES" | "NO";
  avgPrice: number;
  size: number;       // shares
  costBasis: number;  // USDC spent
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: string;
}

export interface RiskState {
  totalExposure: number;     // total USDC at risk
  dailyPnl: number;          // realized P&L today
  openPositionCount: number;
  maxPositionReached: boolean;
  dailyLossLimitHit: boolean;
  canTrade: boolean;
}
