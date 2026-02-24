import { childLogger } from "./logger";

const log = childLogger("retry");

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Retry an async function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30_000 } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) {
        log.error({ err, label, attempt }, "All retries exhausted");
        throw err;
      }
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      log.warn({ label, attempt, nextRetryMs: Math.round(jitter) }, "Retrying");
      await sleep(jitter);
    }
  }

  throw new Error("Unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
