import { useState } from "react";
import type { AuditReport } from "@ether-hunt/shared";
import type { Health } from "../lib/api";
import { countGraphRows } from "../lib/risk";

type Props = {
  health: Health | null;
  report: AuditReport | null;
};

type CardState = "proven" | "armed" | "off";

function StateBadge({ state }: { state: CardState }) {
  const text =
    state === "proven" ? "PROVEN" : state === "armed" ? "ARMED" : "NOT CONFIGURED";
  return <span className={`proof-badge ${state}`}>{text}</span>;
}

function Row({
  k,
  v,
  mono = true,
}: {
  k: string;
  v: string | undefined;
  mono?: boolean;
}) {
  if (!v) return null;
  return (
    <div className="proof-row">
      <span>{k}</span>
      <span className={mono ? "mono ellipsis" : "ellipsis"}>{v}</span>
    </div>
  );
}

function endpointHost(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The prize-legibility panel: one card per selected ETHOnline partner, each
 * carrying the artefact an async reviewer needs to verify it themselves.
 */
export function ProofRail({ health, report }: Props) {
  const [copied, setCopied] = useState(false);
  const payment = report?.sources.payment;

  const hederaProven = payment?.rail === "hedera-x402" && payment.settled;
  const arcProven = payment?.rail === "arc-gateway" && payment.settled;
  const graphLive = Boolean(report?.sources.graph.live);

  const hederaState: CardState = hederaProven
    ? "proven"
    : health?.x402.payTo && health.x402.hederaScheme
      ? "armed"
      : "off";
  const graphState: CardState = graphLive
    ? "proven"
    : report
      ? "off"
      : "armed";
  const arcState: CardState = arcProven
    ? "proven"
    : health?.x402.arcGateway
      ? "armed"
      : "off";

  const graphEvidence = report ? countGraphRows(report) : 0;
  // The query the scan actually ran — the deployed schema decides which one,
  // so copying a hardcoded constant could hand a reviewer something that fails.
  const graphQuery = report?.sources.graph.query;

  function copyQuery() {
    if (!graphQuery) return;
    void navigator.clipboard
      .writeText(graphQuery)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="proof-rail" aria-label="Partner integration proofs">
      <div className="container">
        <div className="proof-head">
          <h2 className="section-title">Verifiable rails</h2>
          <p className="section-lead">
            Three integrations, three artefacts. Every claim below links to
            something a reviewer can open and check independently.
          </p>
        </div>

        <div className="proof-cards">
          <article className={`proof-card hedera ${hederaState}`}>
            <header>
              <h3>Hedera · x402</h3>
              <StateBadge state={hederaState} />
            </header>
            <p className="proof-claim">
              Pay-per-scan gate. Unpaid requests get HTTP 402; the agent settles
              USDC through Blocky402 before the audit runs.
            </p>
            <div className="proof-rows">
              <Row k="network" v={health?.x402.network} />
              <Row k="scheme" v={health?.x402.hederaScheme ? "exact" : undefined} />
              <Row k="price" v="$0.01 USDC / scan" />
              <Row k="payTo" v={payment?.payTo} />
            </div>
            <div className="proof-actions">
              {hederaProven && payment?.explorerUrl ? (
                <a
                  className="proof-link primary"
                  href={payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Settle tx on HashScan
                </a>
              ) : null}
              {payment?.facilitatorDocsUrl ? (
                <a
                  className="proof-link"
                  href={payment.facilitatorDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Facilitator docs
                </a>
              ) : null}
            </div>
          </article>

          <article className={`proof-card graph ${graphState}`}>
            <header>
              <h3>The Graph · live data</h3>
              <StateBadge state={graphState} />
            </header>
            <p className="proof-claim">
              Our subgraph folds raw approvals into live{" "}
              <code>Allowance</code> state, so findings cite what is still
              spendable — not just what was once signed. The AI layer may only
              summarise these rows; it cannot invent evidence.
            </p>
            <div className="proof-rows">
              <Row k="endpoint" v={endpointHost(report?.sources.graph.endpoint)} />
              <Row
                k="schema"
                v={
                  report?.sources.graph.mode === "allowance-state"
                    ? "allowance state"
                    : report
                      ? "approval events"
                      : undefined
                }
              />
              <Row
                k="cited"
                v={report ? `${graphEvidence} Graph rows` : undefined}
              />
              <Row
                k="ai"
                v={
                  health?.ai.configured
                    ? `${health.ai.provider} · cite-only`
                    : "heuristics only"
                }
              />
            </div>
            <div className="proof-actions">
              <button
                type="button"
                className="proof-link"
                onClick={copyQuery}
                disabled={!graphQuery}
              >
                {copied ? "Query copied" : "Copy subgraph query"}
              </button>
              {report?.sources.graph.endpoint ? (
                <a
                  className="proof-link"
                  href={report.sources.graph.endpoint}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open endpoint
                </a>
              ) : null}
            </div>
          </article>

          <article className={`proof-card arc ${arcState}`}>
            <header>
              <h3>Arc · Circle Agent Stack</h3>
              <StateBadge state={arcState} />
            </header>
            <p className="proof-claim">
              A second rail where an autonomous agent wallet pays from its own
              USDC balance over Circle Gateway — no human in the loop.
            </p>
            <div className="proof-rows">
              <Row k="chain" v="ARC-TESTNET" />
              <Row k="rail" v="Gateway nanopayments" />
              <Row k="payTo" v={health?.x402.arcPayTo} />
              <Row k="gas" v="USDC-native" />
            </div>
            <div className="proof-actions">
              {arcProven && payment?.agentExplorerUrl ? (
                <a
                  className="proof-link primary"
                  href={payment.agentExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Agent wallet explorer
                </a>
              ) : null}
              {arcProven && payment?.explorerUrl ? (
                <a
                  className="proof-link"
                  href={payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Recipient explorer
                </a>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
