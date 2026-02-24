import { OrderBook } from "./types";
import { childLogger, withRetry } from "../utils";

const log = childLogger("prices");

interface ClobOrderBookResponse {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

/**
 * Fetch the CLOB order book for a given token ID.
 */
export async function fetchOrderBook(
  clobApiUrl: string,
  tokenId: string
): Promise<OrderBook> {
  const url = `${clobApiUrl}/book?token_id=${tokenId}`;

  const data = await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CLOB book ${res.status}: ${await res.text()}`);
    return res.json() as Promise<ClobOrderBookResponse>;
  }, `clob-book-${tokenId.slice(0, 8)}`);

  const bids = (data.bids || []).map((b) => ({
    price: parseFloat(b.price),
    size: parseFloat(b.size),
  }));
  const asks = (data.asks || []).map((a) => ({
    price: parseFloat(a.price),
    size: parseFloat(a.size),
  }));

  const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.price)) : 0;
  const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => a.price)) : 1;

  log.debug(
    { tokenId: tokenId.slice(0, 8), bestBid, bestAsk, spread: bestAsk - bestBid },
    "Order book"
  );

  return {
    tokenId,
    bids,
    asks,
    bestBid,
    bestAsk,
    spread: bestAsk - bestBid,
  };
}

/**
 * Fetch order books for multiple tokens in parallel.
 */
export async function fetchOrderBooks(
  clobApiUrl: string,
  tokenIds: string[]
): Promise<Map<string, OrderBook>> {
  const results = await Promise.allSettled(
    tokenIds.map((id) => fetchOrderBook(clobApiUrl, id))
  );

  const books = new Map<string, OrderBook>();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      books.set(tokenIds[i], r.value);
    } else {
      log.error({ tokenId: tokenIds[i], err: r.reason }, "Failed to fetch order book");
    }
  }

  return books;
}
