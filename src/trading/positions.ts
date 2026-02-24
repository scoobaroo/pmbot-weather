import { Position } from "./types";
import { childLogger } from "../utils/logger";

const log = childLogger("positions");

/**
 * In-memory position tracker.
 * Markets resolve daily so no persistence needed.
 */
export class PositionTracker {
  private positions: Map<string, Position> = new Map();
  private realizedPnl = 0;

  /** Add or update a position after a fill. */
  addFill(
    tokenId: string,
    conditionId: string,
    city: string,
    date: string,
    bucketLabel: string,
    side: "YES" | "NO",
    price: number,
    sizeUsd: number
  ): void {
    const existing = this.positions.get(tokenId);
    if (existing) {
      // Average in
      const totalCost = existing.costBasis + sizeUsd;
      const totalShares = existing.size + sizeUsd / price;
      existing.avgPrice = totalCost / totalShares;
      existing.size = totalShares;
      existing.costBasis = totalCost;
      log.info(
        { tokenId: tokenId.slice(0, 8), avgPrice: existing.avgPrice.toFixed(3), shares: totalShares.toFixed(2) },
        "Updated position"
      );
    } else {
      const shares = sizeUsd / price;
      this.positions.set(tokenId, {
        tokenId,
        conditionId,
        city,
        date,
        bucketLabel,
        side,
        avgPrice: price,
        size: shares,
        costBasis: sizeUsd,
        currentPrice: price,
        unrealizedPnl: 0,
        openedAt: new Date().toISOString(),
      });
      log.info(
        { tokenId: tokenId.slice(0, 8), side, price, sizeUsd },
        "Opened position"
      );
    }
  }

  /** Update current prices and P&L. */
  updatePrices(priceMap: Map<string, number>): void {
    for (const [tokenId, pos] of this.positions) {
      const price = priceMap.get(tokenId);
      if (price !== undefined) {
        pos.currentPrice = price;
        pos.unrealizedPnl = (price - pos.avgPrice) * pos.size;
      }
    }
  }

  /** Close a position (market resolved). */
  closePosition(tokenId: string, settlementPrice: number): number {
    const pos = this.positions.get(tokenId);
    if (!pos) return 0;

    const pnl = (settlementPrice - pos.avgPrice) * pos.size;
    this.realizedPnl += pnl;
    this.positions.delete(tokenId);

    log.info(
      { tokenId: tokenId.slice(0, 8), pnl: pnl.toFixed(2), settlementPrice },
      "Closed position"
    );
    return pnl;
  }

  /** Get all open positions. */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /** Get realized P&L for the day. */
  getRealizedPnl(): number {
    return this.realizedPnl;
  }

  /** Get total unrealized P&L. */
  getUnrealizedPnl(): number {
    return this.getPositions().reduce((sum, p) => sum + p.unrealizedPnl, 0);
  }

  /** Reset daily counters. */
  resetDaily(): void {
    this.realizedPnl = 0;
    log.info("Daily P&L reset");
  }
}
