import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { isAddressLike, type AuditReport } from "@ether-hunt/shared";
import { analyzeEvidence, summarizeFindings } from "./analyze.js";
import { hederaPaidScan } from "@ether-hunt/agent-consumer/hedera";
import { arcPaidScan } from "@ether-hunt/agent-consumer/arc";
import {
  createPaymentMiddleware,
  resolveHederaSettleExplorerUrl,
} from "./payment.js";
import { createArcPaymentMiddleware } from "./payment-arc.js";
import { takeEvidence, warmEvidence } from "./evidenceGather.js";
import { synthesizeWithAi } from "./synthesize.js";


const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const app = new Hono();
const port = Number(process.env.PORT ?? 8787);
const paymentGate = createPaymentMiddleware();
const arcPaymentGate = createArcPaymentMiddleware();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ether-hunt-audit-api",
    partners: ["hedera-x402", "the-graph", "arc-agent-stack"],
    x402: {
      bypass: process.env.DEV_BYPASS_PAYMENT !== "false",
      payTo: Boolean(process.env.HEDERA_SERVICE_ACCOUNT_ID),
      network: process.env.X402_NETWORK ?? "hedera:testnet",
      hederaScheme: true,
      hederaBuyer: Boolean(
        process.env.HEDERA_AGENT_ACCOUNT_ID &&
          process.env.HEDERA_AGENT_PRIVATE_KEY,
      ),
      arcGateway: Boolean(
        process.env.ARC_SERVICE_ADDRESS || process.env.ARC_AGENT_ADDRESS,
      ),
      arcPayTo:
        process.env.ARC_SERVICE_ADDRESS || process.env.ARC_AGENT_ADDRESS || null,
      webPay: {
        hedera: "/scan/hedera",
        arc: "/scan/arc",
        local: "/scan/local",
      },
    },
    ai: {
      configured: Boolean(
        process.env.DEEPSEEK_API_KEY?.trim() ||
          process.env.ANTHROPIC_API_KEY?.trim() ||
          process.env.OPENAI_API_KEY?.trim(),
      ),
      provider: process.env.DEEPSEEK_API_KEY?.trim()
        ? "deepseek"
        : process.env.OPENAI_API_KEY?.trim()
          ? "openai"
          : process.env.ANTHROPIC_API_KEY?.trim()
            ? "anthropic"
            : "none",
    },
  }),
);

const auditBody = z.object({
  chainId: z.number().int().positive().default(1),
  address: z.string().min(1),
});

async function runAudit(c: Context) {
  const json = await c.req.json().catch(() => null);
  const parsed = auditBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }

  const address = parsed.data.address.trim();
  if (!isAddressLike(address)) {
    return c.json({ error: "invalid_address" }, 400);
  }

  // Prefer warm cache filled while x402 settle was in flight (web paid scans).
  const bundle = await takeEvidence(address);
  const { graph, evidence, graphNote } = bundle;

  const ruleFindings = analyzeEvidence(evidence);
  const ai = await synthesizeWithAi({
    address: address.toLowerCase(),
    evidence,
    ruleFindings,
    graphLive: graph.live,
  });
  const findings = [...ruleFindings, ...ai.findings];
  const payment = c.get("payment");

  const report: AuditReport = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    chainId: parsed.data.chainId,
    address: address.toLowerCase(),
    networkLabel:
      parsed.data.chainId === 1 ? "Ethereum" : `chain-${parsed.data.chainId}`,
    summary: ai.enabled
      ? `${summarizeFindings(findings)} · AI grounded on live Graph.`
      : summarizeFindings(findings),
    findings,
    evidence,
    ai: {
      enabled: ai.enabled,
      model: ai.model,
      narrative: ai.narrative,
      note: ai.note,
    },
    sources: {
      graph: {
        live: graph.live,
        endpoint: graph.endpoint,
        note: graphNote,
      },
      payment: {
        required: payment.required,
        settled: payment.settled,
        rail: payment.rail,
        note: payment.note,
        facilitatorUrl: payment.facilitatorUrl,
        facilitatorDocsUrl: payment.facilitatorDocsUrl,
        payTo: payment.payTo,
        explorerUrl: payment.explorerUrl,
        agentExplorerUrl: payment.agentExplorerUrl,
      },
    },
  };

  return c.json(report);
}

app.post("/audit", paymentGate, runAudit);
app.post("/audit/arc", arcPaymentGate, runAudit);

/** Unpaid UI path — never counts as Hedera/Arc prize settle. */
app.post("/scan/local", async (c) => {
  c.set("payment", {
    required: false,
    settled: true,
    rail: "dev-bypass",
    note: "Local UI scan — unpaid; use Hedera/Arc rails for prize demos.",
  });
  return runAudit(c);
});

/**
 * Browser one-click buyers: server-side agent wallets settle real x402,
 * then return the audit report. Gated endpoints stay prize-valid.
 */
app.post("/scan/hedera", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = auditBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }
  const address = parsed.data.address.trim();
  if (!isAddressLike(address)) {
    return c.json({ error: "invalid_address" }, 400);
  }

  const port = Number(process.env.PORT ?? 8787);
  const apiUrl =
    process.env.AUDIT_API_URL?.trim() || `http://127.0.0.1:${port}`;

  // Overlap Graph/RPC with Blocky402 settle so paid /audit is mostly AI.
  warmEvidence(address);

  try {
    const { status, body } = await hederaPaidScan({
      apiUrl,
      address,
      chainId: parsed.data.chainId,
    });
    if (status >= 200 && status < 300) {
      const report = body as AuditReport;
      const payTo = report.sources?.payment?.payTo;
      if (payTo) {
        report.sources.payment.explorerUrl =
          await resolveHederaSettleExplorerUrl(payTo, {
            agentId: process.env.HEDERA_AGENT_ACCOUNT_ID,
            attempts: 2,
          });
      }
      return c.json(report);
    }
    return c.json(body, status as 400);
  } catch (err) {
    return c.json(
      {
        error: "hedera_pay_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
});

app.post("/scan/arc", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = auditBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }
  const address = parsed.data.address.trim();
  if (!isAddressLike(address)) {
    return c.json({ error: "invalid_address" }, 400);
  }

  const port = Number(process.env.PORT ?? 8787);
  const apiUrl =
    process.env.AUDIT_API_URL?.trim() || `http://127.0.0.1:${port}`;

  warmEvidence(address);

  try {
    const { status, body } = await arcPaidScan({
      apiUrl,
      address,
      chainId: parsed.data.chainId,
    });
    if (status >= 200 && status < 300) return c.json(body);
    return c.json(body, status as 400);
  } catch (err) {
    return c.json(
      {
        error: "arc_pay_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
});

app.get("/partners", (c) =>
  c.json({
    selected: [
      {
        partner: "Hedera",
        track: "AI & Agentic Payments (x402)",
        status:
          "ExactHederaScheme + Blocky402; POST /audit with Hedera agent signer",
      },
      {
        partner: "The Graph",
        track: "Best AI Use Case (From Scratch)",
        status: "live when GRAPH_SUBGRAPH_URL set; RPC fallback is not Graph",
      },
      {
        partner: "Arc",
        track: "Agentic Economy / Circle Agent Stack",
        status:
          "POST /audit/arc via Circle Gateway + `circle services pay --chain ARC-TESTNET`",
      },
    ],
  }),
);

console.log(`Ether Hunt audit-api on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port });
