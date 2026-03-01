import { AppConfig } from "../config/types";
import { RiskState, Position } from "./types";
import { childLogger } from "../utils/logger";

const log = childLogger("risk");

/**
 * Evaluate current risk state based on positions and config.
 */
export function evaluateRisk(
  positions: Position[],
  dailyRealizedPnl: number,
  config: AppConfig
): RiskState {
  const totalExposure = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const openPositionCount = positions.length;
  const maxPositionReached = totalExposure >= config.bankrollUsd * 0.8; // use up to 80% of bankroll
  const dailyLossLimitHit = dailyRealizedPnl <= -config.maxDailyLossUsd;

  const canTrade = !maxPositionReached && !dailyLossLimitHit;

  const state: RiskState = {
    totalExposure,
    dailyPnl: dailyRealizedPnl,
    openPositionCount,
    maxPositionReached,
    dailyLossLimitHit,
    canTrade,
  };

  if (!canTrade) {
    log.warn(state, "Risk limit hit — trading disabled");
  }

  return state;
}

/**
 * Check if a specific trade would violate risk limits.
 */
export function canPlaceTrade(
  sizeUsd: number,
  positions: Position[],
  dailyRealizedPnl: number,
  config: AppConfig
): { allowed: boolean; reason?: string } {
  const risk = evaluateRisk(positions, dailyRealizedPnl, config);

  if (!risk.canTrade) {
    return { allowed: false, reason: "Risk limits hit" };
  }

  if (sizeUsd > config.maxPositionUsd) {
    return { allowed: false, reason: `Size $${sizeUsd} exceeds max position $${config.maxPositionUsd}` };
  }

  if (risk.totalExposure + sizeUsd > config.bankrollUsd) {
    return { allowed: false, reason: "Would exceed bankroll" };
  }

  return { allowed: true };
}
