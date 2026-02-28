import "dotenv/config";
import { loadConfig } from "../src/config";
import { getClobClient, resetClient } from "../src/trading/client";
import { checkBalance } from "../src/trading/executor";

async function main() {
  resetClient();
  const config = loadConfig();
  console.log("Proxy wallet:", config.proxyWallet);
  const client = await getClobClient(config);
  const balance = await checkBalance(client);
  console.log("USDC balance:", balance);
}

main().catch(console.error);
