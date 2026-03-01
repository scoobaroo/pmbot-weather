import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Position } from "./types";
import { PositionTracker } from "./positions";
import { AppConfig } from "../config/types";
import { childLogger } from "../utils/logger";

const log = childLogger("profit-taker");

export interface ExitSignal {
  position: Position;
  currentPrice: number;
  forecastProb: number;
  remainingEdge: number;
  reason: string;
}

/**
 * Evaluate open positions against current forecasts and market prices.
 * Returns positions that should be exited.
 *
 * Exit rules (maximize portfolio growth):
 * 1. Edge gone: remaining edge < half the entry threshold → take profit
 * 2. Edge reversed: forecast now disagrees with our side → cut loss
 * 3. Near-certain profit: market moved >80% toward resolution value → lock in
 */
export function evaluateExits(
  positions: Position[],
  forecastMap: Map<string, number>, // tokenId → current forecast probability
  priceMap: Map<string, number>,    // tokenId → current market YES price
  config: AppConfig
): ExitSignal[] {
  const exits: ExitSignal[] = [];
  const exitThreshold = config.edgeThreshold * 0.5; // Exit when edge drops below half entry threshold

  for (const pos of positions) {
    const currentPrice = priceMap.get(pos.tokenId);
    const forecastProb = forecastMap.get(pos.tokenId);

    if (currentPrice === undefined || forecastProb === undefined) continue;

    let remainingEdge: number;
    let shouldExit = false;
    let reason = "";

    if (pos.side === "YES") {
      // We hold YES tokens. Remaining edge = forecast - current market price
      remainingEdge = forecastProb - currentPrice;

      // Rule 1: Edge evaporated — market caught up to our forecast
      if (remainingEdge < exitThreshold && currentPrice > pos.avgPrice) {
        shouldExit = true;
        reason = `Edge gone (${(remainingEdge * 100).toFixed(1)}%), profit ${((currentPrice - pos.avgPrice) * pos.size).toFixed(2)}`;
      }

      // Rule 2: Edge reversed — forecast now lower than market
      if (remainingEdge < 0) {
        shouldExit = true;
        reason = `Edge reversed (${(remainingEdge * 100).toFixed(1)}%), cut loss`;
      }

      // Rule 3: Near-certain profit — market >80% of the way to $1
      if (currentPrice > 0.80 && pos.avgPrice < 0.50) {
        shouldExit = true;
        reason = `Near-certain (${(currentPrice * 100).toFixed(0)}¢), lock in profit`;
      }
    } else {
      // We hold NO position (bought NO at 1-marketPrice)
      // Our profit comes from YES price dropping
      remainingEdge = (1 - forecastProb) - (1 - currentPrice);
      // Simplifies to: currentPrice - forecastProb

      if (remainingEdge < exitThreshold && (1 - currentPrice) > pos.avgPrice) {
        shouldExit = true;
        reason = `Edge gone (${(remainingEdge * 100).toFixed(1)}%), profit ${(((1 - currentPrice) - pos.avgPrice) * pos.size).toFixed(2)}`;
      }

      if (remainingEdge < 0) {
        shouldExit = true;
        reason = `Edge reversed (${(remainingEdge * 100).toFixed(1)}%), cut loss`;
      }

      if (currentPrice < 0.20 && pos.avgPrice < 0.50) {
        shouldExit = true;
        reason = `Near-certain (NO at ${((1 - currentPrice) * 100).toFixed(0)}¢), lock in profit`;
      }
    }

    if (shouldExit) {
      exits.push({
        position: pos,
        currentPrice,
        forecastProb,
        remainingEdge,
        reason,
      });
    }
  }

  if (exits.length > 0) {
    log.info(
      { exits: exits.length, total: positions.length },
      "Positions flagged for exit"
    );
  }

  return exits;
}

/**
 * Execute exit orders — sell positions back to the market.
 */
export async function executeExits(
  exits: ExitSignal[],
  client: ClobClient,
  tracker: PositionTracker,
  config: AppConfig
): Promise<number> {
  let exitCount = 0;

  for (const exit of exits) {
    const pos = exit.position;

    if (config.dryRun) {
      log.info(
        {
          bucket: pos.bucketLabel,
          side: pos.side,
          entry: pos.avgPrice.toFixed(3),
          current: exit.currentPrice.toFixed(3),
          forecast: exit.forecastProb.toFixed(3),
          reason: exit.reason,
        },
        "DRY RUN — would exit position"
      );
      exitCount++;
      continue;
    }

    try {
      // To exit a YES position: sell YES tokens at current market price
      // To exit a NO position: sell NO tokens (buy YES at current price)
      const side = pos.side === "YES" ? Side.SELL : Side.BUY;
      const amount = Math.round(pos.size * 100) / 100; // shares for SELL, USDC for BUY

      if (amount < 1) {
        log.debug({ bucket: pos.bucketLabel }, "Position too small to exit");
        continue;
      }

      log.info(
        {
          bucket: pos.bucketLabel,
          side: pos.side === "YES" ? "SELL" : "BUY_TO_CLOSE",
          amount,
          reason: exit.reason,
        },
        "Exiting position (FOK market order)"
      );

      const resp = await client.createAndPostMarketOrder(
        {
          tokenID: pos.tokenId,
          amount,
          side,
        },
        undefined,
        OrderType.FOK
      );

      const r = resp as { orderID?: string; success?: boolean; errorMsg?: string } | undefined;
      if (!r?.orderID) {
        log.warn({ bucket: pos.bucketLabel, resp: JSON.stringify(resp) }, "Exit order failed");
        continue;
      }

      // Close position in tracker
      const pnl = tracker.closePosition(pos.tokenId, exit.currentPrice);
      log.info(
        {
          bucket: pos.bucketLabel,
          orderId: r.orderID,
          pnl: pnl.toFixed(2),
          reason: exit.reason,
        },
        "Position exited"
      );
      exitCount++;
    } catch (err) {
      log.error({ err, bucket: pos.bucketLabel }, "Exit order failed");
    }
  }

  return exitCount;
}
