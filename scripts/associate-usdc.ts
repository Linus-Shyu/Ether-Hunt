/**
 * Associate Hedera Testnet USDC (0.0.429274) with an ECDSA account.
 * Usage:
 *   HEDERA_ACCOUNT_ID=0.0.x HEDERA_PRIVATE_KEY=0x... npx tsx scripts/associate-usdc.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TokenId,
  AccountId,
  HEDERA_TESTNET_USDC,
} from "@x402/hedera";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID?.trim();
  const privateKey = process.env.HEDERA_PRIVATE_KEY?.trim();

  if (!accountId || !privateKey) {
    console.error("Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY");
    process.exit(1);
  }

  const key = PrivateKey.fromStringECDSA(privateKey);
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(accountId),
    key,
  );

  try {
    const tx = await new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(HEDERA_TESTNET_USDC)])
      .freezeWith(client)
      .sign(key);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    console.log(
      `associated ${accountId} with USDC ${HEDERA_TESTNET_USDC}: ${receipt.status.toString()}`,
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
