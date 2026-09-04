import type { Context, Next } from "hono";

/**
 * Payment gate placeholder for Hedera x402 + Blocky402.
 *
 * Local default: DEV_BYPASS_PAYMENT=true allows audits without settlement.
 * Prize demos MUST set DEV_BYPASS_PAYMENT=false and complete a real x402 flow.
 */
export async function paymentGate(c: Context, next: Next) {
  const bypassEnv = process.env.DEV_BYPASS_PAYMENT !== "false";
  const bypassHeader = c.req.header("x-ether-hunt-dev-bypass") === "1";
  const paymentHeader = c.req.header("x-payment");

  if (bypassEnv || bypassHeader) {
    c.set("payment", {
      required: false,
      settled: true,
      rail: "dev-bypass" as const,
      note: "DEV bypass active — not valid for Hedera prize demo.",
    });
    await next();
    return;
  }

  if (!paymentHeader) {
    return c.json(
      {
        error: "payment_required",
        message:
          "Pay via Hedera x402 (Blocky402) then retry with payment proof header.",
        accepts: {
          network: "hedera-testnet",
          facilitator: "Blocky402",
          rail: "x402",
        },
      },
      402,
    );
  }

  // TODO: verify payment with Blocky402 facilitator (wire official PoC next)
  c.set("payment", {
    required: true,
    settled: true,
    rail: "hedera-x402" as const,
    note: "Payment header present — replace with Blocky402 verify/settle.",
  });
  await next();
}

declare module "hono" {
  interface ContextVariableMap {
    payment: {
      required: boolean;
      settled: boolean;
      rail: "hedera-x402" | "dev-bypass" | "none";
      note: string;
    };
  }
}
