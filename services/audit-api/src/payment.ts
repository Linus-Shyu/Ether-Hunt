import type { Context, Next } from "hono";

export type PaymentState = {
  required: boolean;
  settled: boolean;
  rail: "hedera-x402" | "dev-bypass" | "none";
  note: string;
};

const USDC_PRICE = process.env.X402_PRICE ?? "$0.01";
const NETWORK = (process.env.X402_NETWORK ?? "hedera:testnet") as
  | "hedera:testnet"
  | "hedera:mainnet";

function facilitatorUrl(): string {
  if (process.env.X402_FACILITATOR_URL) return process.env.X402_FACILITATOR_URL;
  return NETWORK === "hedera:mainnet"
    ? "https://api.blocky402.com"
    : "https://x402.org/facilitator";
}

function payTo(): string | undefined {
  return process.env.HEDERA_SERVICE_ACCOUNT_ID?.trim() || undefined;
}

function bypassEnabled(): boolean {
  return process.env.DEV_BYPASS_PAYMENT !== "false";
}

/**
 * Hedera x402 gate aligned with official PoC flow:
 * - missing payment → HTTP 402 + accepts[]
 * - payment header → facilitator /verify (Blocky402 on mainnet, x402.org on testnet)
 *
 * Full ExactHederaScheme signing requires `@x402/hedera` (currently blocked by
 * missing `@hiero-ledger/proto@2.31.0` on npm). Until that resolves, clients can
 * attach a facilitator-verified PAYMENT-SIGNATURE / X-PAYMENT header from the
 * official PoC agent, or use DEV bypass for UI work.
 */
export async function paymentGate(c: Context, next: Next) {
  const bypassHeader = c.req.header("x-ether-hunt-dev-bypass") === "1";
  if (bypassEnabled() || bypassHeader) {
    c.set("payment", {
      required: false,
      settled: true,
      rail: "dev-bypass",
      note: "DEV bypass active — not valid for Hedera prize demo.",
    } satisfies PaymentState);
    await next();
    return;
  }

  const receiver = payTo();
  if (!receiver) {
    return c.json(
      {
        error: "misconfigured",
        message:
          "Set HEDERA_SERVICE_ACCOUNT_ID and DEV_BYPASS_PAYMENT=false for live x402.",
      },
      500,
    );
  }

  const paymentHeader =
    c.req.header("PAYMENT-SIGNATURE") ??
    c.req.header("payment-signature") ??
    c.req.header("X-PAYMENT") ??
    c.req.header("x-payment");

  const accepts = [
    {
      scheme: "exact",
      price: USDC_PRICE,
      network: NETWORK,
      payTo: receiver,
    },
  ];

  if (!paymentHeader) {
    return c.json(
      {
        x402Version: 2,
        error: "payment_required",
        accepts,
        resource: c.req.path,
        description: "Ether Hunt on-chain audit scan",
        facilitator: facilitatorUrl(),
        mimeType: "application/json",
      },
      402,
    );
  }

  const verified = await verifyWithFacilitator(paymentHeader, accepts[0]);
  if (!verified.ok) {
    return c.json(
      {
        x402Version: 2,
        error: "invalid_payment",
        message: verified.message,
        accepts,
        facilitator: facilitatorUrl(),
      },
      402,
    );
  }

  c.set("payment", {
    required: true,
    settled: true,
    rail: "hedera-x402",
    note: `Verified via ${facilitatorUrl()}`,
  } satisfies PaymentState);

  await next();
}

async function verifyWithFacilitator(
  paymentHeader: string,
  accept: { scheme: string; price: string; network: string; payTo: string },
): Promise<{ ok: boolean; message: string }> {
  const url = `${facilitatorUrl().replace(/\/$/, "")}/verify`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        paymentHeader,
        paymentRequirements: accept,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        message: `Facilitator HTTP ${response.status}: ${text.slice(0, 300)}`,
      };
    }
    return { ok: true, message: text.slice(0, 200) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

declare module "hono" {
  interface ContextVariableMap {
    payment: PaymentState;
  }
}
