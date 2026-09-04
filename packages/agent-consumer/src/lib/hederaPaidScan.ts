/**
 * Hedera x402 ExactHederaScheme buyer — shared by CLI agent and web proxy.
 */
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";

export function createHederaPaidFetch(env: NodeJS.ProcessEnv = process.env): typeof fetch {
  const accountId = env.HEDERA_AGENT_ACCOUNT_ID?.trim();
  const privateKey = env.HEDERA_AGENT_PRIVATE_KEY?.trim();
  if (!accountId || !privateKey) {
    throw new Error(
      "Set HEDERA_AGENT_ACCOUNT_ID and HEDERA_AGENT_PRIVATE_KEY in .env",
    );
  }

  const network = (env.X402_NETWORK ?? "hedera:testnet") as
    | "hedera:testnet"
    | "hedera:mainnet";

  const signer = createClientHederaSigner(
    accountId,
    PrivateKey.fromStringECDSA(privateKey),
    { network },
  );

  const client = new x402Client().register(
    "hedera:*",
    new ExactHederaScheme(signer),
  );

  return wrapFetchWithPayment(globalThis.fetch, client);
}

export async function hederaPaidScan(opts: {
  apiUrl?: string;
  address: string;
  chainId?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ status: number; body: unknown }> {
  const env = opts.env ?? process.env;
  const api = (opts.apiUrl ?? env.AUDIT_API_URL ?? "http://127.0.0.1:8787").replace(
    /\/$/,
    "",
  );
  const paidFetch = createHederaPaidFetch(env);
  const res = await paidFetch(`${api}/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chainId: opts.chainId ?? 1,
      address: opts.address,
    }),
  });
  const body = await res.json().catch(() => ({ error: "invalid_json" }));
  return { status: res.status, body };
}
