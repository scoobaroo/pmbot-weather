import * as fs from "fs";
import * as path from "path";
import { Position } from "./types";
import { childLogger } from "../utils/logger";

const log = childLogger("positions");

const DATA_DIR = path.resolve("data");
const TRADES_FILE = path.join(DATA_DIR, "trades.jsonl");
const STATE_FILE = path.join(DATA_DIR, "positions.json");

interface TradeRecord {
  type: "fill" | "close";
  tokenId: string;
  conditionId?: string;
  side?: "YES" | "NO";
  price: number;
  sizeUsd: number;
  pnl?: number;
  timestamp: string;
}

interface StateSnapshot {
  positions: Position[];
  realizedPnl: number;
  savedAt: string;
}

/**
 * Position tracker with JSONL trade log and JSON state persistence.
 */
export class PositionTracker {
  private positions: Map<string, Position> = new Map();
  private realizedPnl = 0;

  /** Load state from disk on startup. */
  loadState(): void {
    try {
      if (!fs.existsSync(STATE_FILE)) {
        log.info("No saved state — starting fresh");
        return;
      }
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const state: StateSnapshot = JSON.parse(raw);
      this.realizedPnl = state.realizedPnl || 0;
      this.positions.clear();
      for (const p of state.positions || []) {
        this.positions.set(p.tokenId, p);
      }
      log.info(
        { positions: this.positions.size, realizedPnl: this.realizedPnl.toFixed(2) },
        "Position state loaded"
      );
    } catch (err) {
      log.error({ err }, "Failed to load state — starting fresh");
      this.positions.clear();
      this.realizedPnl = 0;
    }
  }

  /** Save full state snapshot to disk. */
  saveState(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const state: StateSnapshot = {
        positions: Array.from(this.positions.values()),
        realizedPnl: this.realizedPnl,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      log.error({ err }, "Failed to save state");
    }
  }

  /** Append a trade record to the JSONL log. */
  private persistTrade(record: TradeRecord): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.appendFileSync(TRADES_FILE, JSON.stringify(record) + "\n");
    } catch (err) {
      log.error({ err }, "Failed to persist trade");
    }
  }

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

    this.persistTrade({ type: "fill", tokenId, conditionId, side, price, sizeUsd, timestamp: new Date().toISOString() });
    this.saveState();
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

    this.persistTrade({ type: "close", tokenId, price: settlementPrice, sizeUsd: pos.costBasis, pnl, timestamp: new Date().toISOString() });
    this.saveState();

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
