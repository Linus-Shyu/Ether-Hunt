import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { isAddressLike, type AuditReport } from "@ether-hunt/shared";
import { analyzeEvidence, summarizeFindings } from "./analyze.js";
import { fetchGraphEvidence } from "./graph.js";
import { paymentGate } from "./payment.js";
import { fetchRpcApprovalEvidence } from "./rpcEvidence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const app = new Hono();
const port = Number(process.env.PORT ?? 8787);

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
    },
  }),
);

const auditBody = z.object({
  chainId: z.number().int().positive().default(1),
  address: z.string().min(1),
});

app.post("/audit", paymentGate, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = auditBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }

  const address = parsed.data.address.trim();
  if (!isAddressLike(address)) {
    return c.json({ error: "invalid_address" }, 400);
  }

  const graph = await fetchGraphEvidence(address);
  let evidence = graph.evidence;
  let graphNote = graph.note;

  if (!graph.live) {
    const rpc = await fetchRpcApprovalEvidence(address);
    evidence = [...rpc.evidence, ...graph.evidence];
    graphNote = `${graph.note} | ${rpc.note}`;
  }

  const findings = analyzeEvidence(evidence);
  const payment = c.get("payment");

  const report: AuditReport = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    chainId: parsed.data.chainId,
    address: address.toLowerCase(),
    networkLabel:
      parsed.data.chainId === 1 ? "Ethereum" : `chain-${parsed.data.chainId}`,
    summary: summarizeFindings(findings),
    findings,
    evidence,
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
      },
    },
  };

  return c.json(report);
});

app.get("/partners", (c) =>
  c.json({
    selected: [
      {
        partner: "Hedera",
        track: "AI & Agentic Payments (x402)",
        status: "402 + facilitator verify wired; need service account for live settle",
      },
      {
        partner: "The Graph",
        track: "Best AI Use Case (From Scratch)",
        status: "live when GRAPH_SUBGRAPH_URL set; RPC fallback is not Graph",
      },
      {
        partner: "Arc",
        track: "Agentic Economy / Circle Agent Stack",
        status: "agent-consumer package calls /audit",
      },
    ],
  }),
);

console.log(`Ether Hunt audit-api on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port });
