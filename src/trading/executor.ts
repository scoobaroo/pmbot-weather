import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { AssetType, OrderResponse } from "@polymarket/clob-client/dist/types";
import { TradeSignal } from "../strategy/types";
import { ExecutionResult } from "./types";
import { AppConfig } from "../config/types";
import { canPlaceTrade } from "./risk";
import { PositionTracker } from "./positions";
import { childLogger } from "../utils/logger";

const log = childLogger("executor");

/**
 * Validate that an order response indicates success.
 */
function validateOrderResponse(resp: unknown): asserts resp is OrderResponse {
  const r = resp as OrderResponse | undefined;
  if (!r) throw new Error("Empty order response");
  if (r.success === false) throw new Error(`Order rejected: ${r.errorMsg || "unknown"}`);
  if (!r.orderID) throw new Error(`Order response missing orderID: ${JSON.stringify(r)}`);
}

/**
 * Check USDC balance before trading.
 */
export async function checkBalance(client: ClobClient): Promise<number> {
  const resp = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
  const rawBalance = parseFloat(resp.balance);
  // USDC has 6 decimals — API may return raw units or already-formatted
  const balance = rawBalance > 1_000_000 ? rawBalance / 1_000_000 : rawBalance;
  log.info({ balance: balance.toFixed(2) }, "USDC balance");
  return balance;
}

/**
 * Execute trade signals via the CLOB, or dry-run log them.
 */
export async function executeSignals(
  signals: TradeSignal[],
  client: ClobClient,
  tracker: PositionTracker,
  config: AppConfig
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  // Check balance before placing any live orders
  if (!config.dryRun) {
    try {
      const balance = await checkBalance(client);
      if (balance < 1) {
        log.warn({ balance }, "Insufficient USDC balance — skipping all orders");
        return results;
      }
    } catch (err) {
      log.error({ err }, "Failed to check balance — skipping all orders");
      return results;
    }
  }

  for (const signal of signals) {
    // Risk check
    const riskCheck = canPlaceTrade(
      signal.sizeUsd,
      tracker.getPositions(),
      tracker.getRealizedPnl(),
      config
    );

    if (!riskCheck.allowed) {
      log.warn(
        { bucket: signal.bucketLabel, reason: riskCheck.reason },
        "Trade blocked by risk"
      );
      results.push({
        orderId: "",
        tokenId: signal.tokenId,
        side: signal.side === "YES" ? "BUY" : "SELL",
        price: signal.marketPrice,
        size: signal.sizeUsd,
        status: "FAILED",
        timestamp: new Date().toISOString(),
        error: riskCheck.reason,
      });
      continue;
    }

    if (config.dryRun) {
      results.push(dryRunSignal(signal));
      continue;
    }

    try {
      const result = await executeLiveOrder(signal, client, tracker);
      results.push(result);
    } catch (err) {
      log.error({ err, signal: signal.bucketLabel }, "Order execution failed");
      results.push({
        orderId: "",
        tokenId: signal.tokenId,
        side: signal.side === "YES" ? "BUY" : "SELL",
        price: signal.marketPrice,
        size: signal.sizeUsd,
        status: "FAILED",
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

function dryRunSignal(signal: TradeSignal): ExecutionResult {
  log.info(
    {
      city: signal.city,
      date: signal.date,
      bucket: signal.bucketLabel,
      side: signal.side,
      edge: `${(signal.edge * 100).toFixed(1)}%`,
      forecast: `${(signal.forecastProb * 100).toFixed(1)}%`,
      market: `${(signal.marketPrice * 100).toFixed(1)}%`,
      size: `$${signal.sizeUsd.toFixed(2)}`,
      kelly: `${(signal.kellyFraction * 100).toFixed(1)}%`,
    },
    "DRY RUN — would place order"
  );

  return {
    orderId: `dry-run-${Date.now()}`,
    tokenId: signal.tokenId,
    side: signal.side === "YES" ? "BUY" : "SELL",
    price: signal.marketPrice,
    size: signal.sizeUsd,
    status: "DRY_RUN",
    timestamp: new Date().toISOString(),
  };
}

async function executeLiveOrder(
  signal: TradeSignal,
  client: ClobClient,
  tracker: PositionTracker
): Promise<ExecutionResult> {
  const side = signal.side === "YES" ? Side.BUY : Side.SELL;
  const size = Math.round((signal.sizeUsd / signal.marketPrice) * 100) / 100; // round to 2dp

  log.info(
    { bucket: signal.bucketLabel, side: signal.side, price: signal.marketPrice, size },
    "Placing live order"
  );

  const resp = await client.createAndPostOrder(
    {
      tokenID: signal.tokenId,
      price: signal.marketPrice,
      size,
      side,
    },
    undefined,
    OrderType.GTC
  );

  // Validate before tracking
  validateOrderResponse(resp);

  const orderId = resp.orderID;
  const status = resp.status === "matched" ? "FILLED" : "PLACED";

  // Track only confirmed orders
  tracker.addFill(
    signal.tokenId,
    signal.conditionId,
    signal.city,
    signal.date,
    signal.bucketLabel,
    signal.side,
    signal.marketPrice,
    signal.sizeUsd
  );

  log.info({ orderId, status, bucket: signal.bucketLabel }, "Order confirmed");

  return {
    orderId,
    tokenId: signal.tokenId,
    side: signal.side === "YES" ? "BUY" : "SELL",
    price: signal.marketPrice,
    size: signal.sizeUsd,
    status: status as ExecutionResult["status"],
    timestamp: new Date().toISOString(),
  };
}
