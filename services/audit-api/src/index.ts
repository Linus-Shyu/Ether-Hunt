import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isAddressLike, type AuditReport } from "@ether-hunt/shared";
import { analyzeEvidence, summarizeFindings } from "./analyze.js";
import { fetchGraphEvidence } from "./graph.js";
import { paymentGate } from "./payment.js";

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
  const findings = analyzeEvidence(graph.evidence);
  const payment = c.get("payment");

  const report: AuditReport = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    chainId: parsed.data.chainId,
    address: address.toLowerCase(),
    networkLabel: parsed.data.chainId === 1 ? "Ethereum" : `chain-${parsed.data.chainId}`,
    summary: summarizeFindings(findings),
    findings,
    evidence: graph.evidence,
    sources: {
      graph: {
        live: graph.live,
        endpoint: graph.endpoint,
        note: graph.note,
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
        status: "gate stubbed — Blocky402 verify next",
      },
      {
        partner: "The Graph",
        track: "Best AI Use Case (From Scratch)",
        status: "live query when GRAPH_SUBGRAPH_URL set",
      },
      {
        partner: "Arc",
        track: "Agentic Economy / Circle Agent Stack",
        status: "consumer agent TBD after API settles",
      },
    ],
  }),
);

console.log(`Ether Hunt audit-api on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port });
