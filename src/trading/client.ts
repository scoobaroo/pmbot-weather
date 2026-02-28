import { Wallet } from "@ethersproject/wallet";
import { ClobClient } from "@polymarket/clob-client";
import { SignatureType } from "@polymarket/order-utils";
import { AppConfig } from "../config/types";
import { childLogger } from "../utils/logger";

const log = childLogger("clob-client");

let clientInstance: ClobClient | null = null;

/**
 * Initialize and return a ClobClient instance.
 * In dry-run mode, returns a client without auth (read-only).
 */
export async function getClobClient(config: AppConfig): Promise<ClobClient> {
  if (clientInstance) return clientInstance;

  if (config.dryRun) {
    log.info("Initializing ClobClient in DRY RUN mode (no auth)");
    clientInstance = new ClobClient(config.clobApiUrl, config.chainId);
    return clientInstance;
  }

  if (!config.privateKey) {
    throw new Error("PRIVATE_KEY required for live trading");
  }

  const wallet = new Wallet(config.privateKey);
  const useProxy = !!config.proxyWallet;
  const sigType = useProxy ? SignatureType.POLY_PROXY : undefined;
  const funder = useProxy ? config.proxyWallet : undefined;

  log.info(
    { address: wallet.address, proxyWallet: funder || "none" },
    "Initializing ClobClient with wallet"
  );

  const client = new ClobClient(
    config.clobApiUrl, config.chainId, wallet,
    undefined, sigType, funder
  );

  // Derive API credentials
  const creds = await client.createOrDeriveApiKey();
  log.info("API key derived");

  clientInstance = new ClobClient(
    config.clobApiUrl, config.chainId, wallet,
    creds, sigType, funder
  );

  return clientInstance;
}

/** Reset the client singleton (for testing). */
export function resetClient(): void {
  clientInstance = null;
}
