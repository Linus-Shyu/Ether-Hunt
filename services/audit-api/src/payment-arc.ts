import type { Context, Next } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import {
  BatchFacilitatorClient,
  GatewayEvmScheme,
} from "@circle-fin/x402-batching/server";
import type { PaymentState } from "./payment.js";

/** Arc Testnet CAIP-2 (USDC gas / Circle Agent Stack demo rail). */
export const ARC_NETWORK = "eip155:5042002" as const;

function arcUsdcPrice(): string {
  const raw = (process.env.X402_ARC_PRICE ?? "$0.01").trim();
  if (/^\$\d+(\.\d+)?$/.test(raw)) return raw;
  console.warn(
    `[payment-arc] ignoring invalid X402_ARC_PRICE=${JSON.stringify(raw)}; using $0.01`,
  );
  return "$0.01";
}
/**
 * Circle CLI Agent Stack signs with maxTimeoutSeconds=2592000 (30d).
 * Default GatewayEvmScheme advertises 604900 (7d+buffer), which makes
 * `circle services pay` payloads fail with "No matching payment requirements".
 */
class ArcAgentStackGatewayScheme extends GatewayEvmScheme {
  async enhancePaymentRequirements(
    paymentRequirements: Parameters<
      GatewayEvmScheme["enhancePaymentRequirements"]
    >[0],
    supportedKind: Parameters<GatewayEvmScheme["enhancePaymentRequirements"]>[1],
    extensionKeys: Parameters<GatewayEvmScheme["enhancePaymentRequirements"]>[2],
  ) {
    const enhanced = await super.enhancePaymentRequirements(
      paymentRequirements,
      supportedKind,
      extensionKeys,
    );
    return {
      ...enhanced,
      maxTimeoutSeconds: Number(
        process.env.X402_ARC_MAX_TIMEOUT_SECONDS ?? 2_592_000,
      ),
    };
  }
}

function sellerAddress(): string | undefined {
  return (
    process.env.ARC_SERVICE_ADDRESS?.trim() ||
    process.env.ARC_AGENT_ADDRESS?.trim() ||
    undefined
  );
}

function gatewayFacilitatorUrl(): string {
  return (
    process.env.CIRCLE_GATEWAY_FACILITATOR_URL?.trim() ||
    "https://gateway-api-testnet.circle.com"
  );
}

function arcExplorerUrl(address: string): string {
  return `https://testnet.arcscan.app/address/${address}`;
}

function bypassEnabled(): boolean {
  return process.env.DEV_BYPASS_PAYMENT !== "false";
}

function createArcResourceServer() {
  const facilitator = new BatchFacilitatorClient({
    url: gatewayFacilitatorUrl(),
  });
  return new x402ResourceServer(facilitator).register(
    "eip155:*",
    new ArcAgentStackGatewayScheme(),
  );
}

/**
 * Circle Gateway / nanopayments gate for POST /audit/arc.
 * Buyer path: Circle Agent Stack (`circle services pay --chain ARC-TESTNET`).
 */
export function createArcPaymentMiddleware() {
  const payTo = sellerAddress();

  if (bypassEnabled()) {
    return async (c: Context, next: Next) => {
      if (c.req.path !== "/audit/arc" || c.req.method !== "POST") {
        await next();
        return;
      }
      c.set("payment", {
        required: false,
        settled: true,
        rail: "dev-bypass",
        note: "DEV bypass — not valid for Arc Agent Stack prize demo.",
      } satisfies PaymentState);
      await next();
    };
  }

  if (!payTo) {
    return async (c: Context, next: Next) => {
      if (c.req.path !== "/audit/arc" || c.req.method !== "POST") {
        await next();
        return;
      }
      return c.json(
        {
          error: "misconfigured",
          message:
            "Set ARC_SERVICE_ADDRESS (or ARC_AGENT_ADDRESS) and DEV_BYPASS_PAYMENT=false for Arc Gateway x402.",
        },
        500,
      );
    };
  }

  const resourceServer = createArcResourceServer();
  const x402 = paymentMiddleware(
    {
      "POST /audit/arc": {
        accepts: {
          scheme: "exact",
          price: arcUsdcPrice(),
          network: ARC_NETWORK,
          payTo,
        },
        description: "Ether Hunt audit via Circle Agent Stack / Arc Gateway",
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
        rail: "arc-gateway",
        note: `Circle Gateway nanopayment → ${payTo}`,
        facilitatorUrl: gatewayFacilitatorUrl(),
        facilitatorDocsUrl: "https://developers.circle.com/gateway",
        payTo,
        explorerUrl: arcExplorerUrl(payTo),
        agentExplorerUrl: process.env.ARC_AGENT_ADDRESS?.trim()
          ? arcExplorerUrl(process.env.ARC_AGENT_ADDRESS.trim())
          : undefined,
      } satisfies PaymentState);
      await next();
    });
  };
}
