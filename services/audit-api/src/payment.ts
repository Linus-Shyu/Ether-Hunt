import type { Context, Next } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

export type PaymentState = {
  required: boolean;
  settled: boolean;
  rail: "hedera-x402" | "arc-gateway" | "dev-bypass" | "none";
  note: string;
  /** Facilitator API host (not always browser-friendly) */
  facilitatorUrl?: string;
  /** Human-readable docs / status page for the facilitator */
  facilitatorDocsUrl?: string;
  payTo?: string;
  explorerUrl?: string;
  /** Optional second explorer (e.g. Arc agent SCA) */
  agentExplorerUrl?: string;
};

const ASSET = (process.env.X402_ASSET ?? "usdc").toLowerCase();
const NETWORK = (process.env.X402_NETWORK ?? "hedera:testnet") as
  | "hedera:testnet"
  | "hedera:mainnet";

/** Normalize USDC money strings; shell-sourced `$0.01` often becomes `.env.01`. */
function usdcPrice(): string {
  const raw = (process.env.X402_PRICE ?? "$0.01").trim();
  if (/^\$\d+(\.\d+)?$/.test(raw)) return raw;
  console.warn(
    `[payment] ignoring invalid X402_PRICE=${JSON.stringify(raw)}; using $0.01`,
  );
  return "$0.01";
}

/** USDC money string, or HBAR AssetAmount (tinybars). */
function paymentPrice(): string | { asset: string; amount: string } {
  if (ASSET === "hbar") {
    // 0.001 HBAR = 100_000 tinybars (matches Hedera x402 PoC)
    return { asset: "0.0.0", amount: process.env.X402_HBAR_AMOUNT ?? "100000" };
  }
  return usdcPrice();
}

function facilitatorUrl(): string {
  if (process.env.X402_FACILITATOR_URL) return process.env.X402_FACILITATOR_URL;
  // Prize path: Blocky402 (testnet + mainnet)
  return NETWORK === "hedera:mainnet"
    ? "https://api.blocky402.com"
    : "https://api.testnet.blocky402.com";
}

function payTo(): string | undefined {
  return process.env.HEDERA_SERVICE_ACCOUNT_ID?.trim() || undefined;
}

function bypassEnabled(): boolean {
  return process.env.DEV_BYPASS_PAYMENT !== "false";
}

function createHederaResourceServer() {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl(),
  });
  return new x402ResourceServer(facilitatorClient).register(
    "hedera:*",
    new ExactHederaScheme({}),
  );
}

function hederaNetworkSlug(): "mainnet" | "testnet" {
  return NETWORK === "hedera:mainnet" ? "mainnet" : "testnet";
}

function hederaExplorerUrl(accountId: string): string {
  return `https://hashscan.io/${hederaNetworkSlug()}/account/${accountId}`;
}

function hederaTxExplorerUrl(transactionId: string): string {
  return `https://hashscan.io/${hederaNetworkSlug()}/transaction/${transactionId}`;
}

function hederaMirrorBase(): string {
  return NETWORK === "hedera:mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

function usdcTokenId(): string {
  return process.env.HEDERA_USDC_TOKEN_ID?.trim() || "0.0.429274";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolve the latest USDC CRYPTOTRANSFER into payTo — opens the tx page
 * (no HashScan Summary / Transactions tab hunting).
 */
export async function resolveHederaSettleExplorerUrl(
  payTo: string,
  opts?: { agentId?: string; attempts?: number },
): Promise<string> {
  const agentId = opts?.agentId?.trim();
  const attempts = opts?.attempts ?? 2;
  const token = usdcTokenId();
  const fallback = hederaExplorerUrl(payTo);

  for (let i = 0; i < attempts; i++) {
    try {
      const url = new URL(`${hederaMirrorBase()}/api/v1/transactions`);
      url.searchParams.set("account.id", payTo);
      url.searchParams.set("transactiontype", "CRYPTOTRANSFER");
      url.searchParams.set("limit", "8");
      url.searchParams.set("order", "desc");
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          transactions?: Array<{
            transaction_id: string;
            token_transfers?: Array<{
              token_id: string;
              account: string;
              amount: number;
            }>;
          }>;
        };
        for (const tx of data.transactions ?? []) {
          const transfers = tx.token_transfers ?? [];
          const credit = transfers.find(
            (t) =>
              t.token_id === token &&
              t.account === payTo &&
              t.amount > 0,
          );
          if (!credit) continue;
          if (agentId) {
            const debit = transfers.find(
              (t) =>
                t.token_id === token &&
                t.account === agentId &&
                t.amount < 0,
            );
            if (!debit) continue;
          }
          return hederaTxExplorerUrl(tx.transaction_id);
        }
      }
    } catch {
      // mirror lag / transient — retry
    }
    await sleep(150);
  }
  return fallback;
}

/**
 * Returns Hono middleware for live Hedera x402 when configured,
 * otherwise a DEV bypass / misconfig gate.
 *
 * Pattern matches Hedera official PoC:
 * https://github.com/hedera-dev/x402-inference-pay-per-request-poc
 */
export function createPaymentMiddleware() {
  const receiver = payTo();

  if (bypassEnabled()) {
    return async (c: Context, next: Next) => {
      if (c.req.path !== "/audit" || c.req.method !== "POST") {
        await next();
        return;
      }
      c.set("payment", {
        required: false,
        settled: true,
        rail: "dev-bypass",
        note: "DEV bypass active — not valid for Hedera prize demo.",
      } satisfies PaymentState);
      await next();
    };
  }

  if (!receiver) {
    return async (c: Context, next: Next) => {
      if (c.req.path !== "/audit" || c.req.method !== "POST") {
        await next();
        return;
      }
      return c.json(
        {
          error: "misconfigured",
          message:
            "Set HEDERA_SERVICE_ACCOUNT_ID and DEV_BYPASS_PAYMENT=false for live x402.",
        },
        500,
      );
    };
  }

  const resourceServer = createHederaResourceServer();
  const x402 = paymentMiddleware(
    {
      "POST /audit": {
        accepts: {
          scheme: "exact",
          price: paymentPrice(),
          network: NETWORK,
          payTo: receiver,
        },
        description: "Ether Hunt on-chain audit scan",
        mimeType: "application/json",
      },
    },
    resourceServer,
  );

  return async (c: Context, next: Next) => {
    return x402(c, async () => {
      c.set("payment", {
        required: true,
        settled: true,
        rail: "hedera-x402",
        note: `Hedera ExactScheme via ${facilitatorUrl()}`,
        facilitatorUrl: facilitatorUrl(),
        facilitatorDocsUrl: "https://hashscan.io/testnet",
        payTo: receiver,
        explorerUrl: hederaExplorerUrl(receiver),
        agentExplorerUrl: process.env.HEDERA_AGENT_ACCOUNT_ID?.trim()
          ? hederaExplorerUrl(process.env.HEDERA_AGENT_ACCOUNT_ID.trim())
          : undefined,
      } satisfies PaymentState);
      await next();
    });
  };
}

declare module "hono" {
  interface ContextVariableMap {
    payment: PaymentState;
  }
}
