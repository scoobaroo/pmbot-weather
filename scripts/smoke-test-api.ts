/**
 * Smoke test: hit the real Gamma API to verify market discovery works.
 * Run: npx ts-node scripts/smoke-test-api.ts
 */
import { parseMarketTitle } from "../src/market/parser";

const GAMMA_API = "https://gamma-api.polymarket.com";
const TEMPERATURE_TAG_ID = "103040";

async function main() {
  console.log("=== Smoke Test: Gamma API Temperature Market Discovery ===\n");

  // 1. Fetch temperature events
  const url = `${GAMMA_API}/events?tag_id=${TEMPERATURE_TAG_ID}&active=true&closed=false&limit=100`;
  console.log(`Fetching: ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL: Gamma API returned ${res.status}`);
    process.exit(1);
  }

  const events = await res.json() as Array<{
    id: string;
    title: string;
    slug: string;
    endDate: string;
    active: boolean;
    markets: Array<{
      conditionId: string;
      question: string;
      clobTokenIds: string;
      outcomePrices: string;
      closed: boolean;
      acceptingOrders: boolean;
    }>;
  }>;

  console.log(`Events found: ${events.length}`);
  if (events.length === 0) {
    console.log("WARN: No temperature events found (may be between daily cycles)");
    process.exit(0);
  }

  // 2. Verify event structure
  let totalMarkets = 0;
  let acceptingMarkets = 0;
  let parsedMarkets = 0;
  let parseFailures: string[] = [];

  for (const event of events) {
    for (const market of event.markets || []) {
      totalMarkets++;
      if (market.acceptingOrders) acceptingMarkets++;

      // Verify clobTokenIds is parseable
      try {
        const tokenIds = JSON.parse(market.clobTokenIds || "[]");
        if (tokenIds.length < 2) {
          console.log(`  WARN: market ${market.conditionId.slice(0, 12)}... has ${tokenIds.length} tokens`);
        }
      } catch {
        console.log(`  FAIL: clobTokenIds not parseable for ${market.question.slice(0, 60)}`);
      }

      // Verify outcomePrices is parseable
      try {
        const prices = JSON.parse(market.outcomePrices || "[]");
        const yesPrice = parseFloat(prices[0]);
        if (isNaN(yesPrice)) {
          console.log(`  WARN: unparseable price for ${market.question.slice(0, 60)}`);
        }
      } catch {
        console.log(`  FAIL: outcomePrices not parseable for ${market.question.slice(0, 60)}`);
      }

      // Verify parser works on real titles
      const parsed = parseMarketTitle(market.question);
      if (parsed) {
        parsedMarkets++;
      } else {
        parseFailures.push(market.question);
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Events:           ${events.length}`);
  console.log(`Total markets:    ${totalMarkets}`);
  console.log(`Accepting orders: ${acceptingMarkets}`);
  console.log(`Parser matched:   ${parsedMarkets}/${totalMarkets}`);

  if (parseFailures.length > 0) {
    console.log(`\nParser failures (${parseFailures.length}):`);
    for (const q of parseFailures) {
      console.log(`  - ${q}`);
    }
  }

  // 3. Verify clob_token_ids lookup (for settlement/price)
  if (acceptingMarkets > 0) {
    const sampleEvent = events.find(e => e.markets.some(m => m.acceptingOrders))!;
    const sampleMarket = sampleEvent.markets.find(m => m.acceptingOrders)!;
    const tokenIds = JSON.parse(sampleMarket.clobTokenIds);
    const sampleTokenId = tokenIds[0];

    console.log(`\n=== Settlement lookup test ===`);
    console.log(`Token: ${sampleTokenId.slice(0, 20)}...`);
    const lookupRes = await fetch(`${GAMMA_API}/markets?clob_token_ids=${sampleTokenId}`);
    const lookupData = await lookupRes.json() as Array<{ question: string; outcomePrices: string; closed: boolean }>;

    if (Array.isArray(lookupData) && lookupData.length > 0 && lookupData[0].question === sampleMarket.question) {
      console.log(`OK: clob_token_ids lookup returned correct market`);
      console.log(`  Q: ${lookupData[0].question.slice(0, 80)}`);
      console.log(`  Price: ${lookupData[0].outcomePrices}`);
    } else {
      console.log(`FAIL: clob_token_ids lookup returned unexpected result`);
      console.log(JSON.stringify(lookupData).slice(0, 200));
    }
  }

  // 4. Print sample event for inspection
  const sample = events[0];
  console.log(`\n=== Sample event ===`);
  console.log(`Title: ${sample.title}`);
  console.log(`Slug:  ${sample.slug}`);
  console.log(`Markets: ${sample.markets.length}`);
  for (const m of sample.markets.slice(0, 3)) {
    const parsed = parseMarketTitle(m.question);
    console.log(`  Q: ${m.question}`);
    console.log(`  Parsed: ${JSON.stringify(parsed)}`);
    console.log(`  Accepting: ${m.acceptingOrders}, Price: ${m.outcomePrices}`);
  }

  const allGood = parseFailures.length === 0;
  console.log(`\n${allGood ? "PASS" : "WARN"}: Smoke test complete`);
  process.exit(allGood ? 0 : 1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
