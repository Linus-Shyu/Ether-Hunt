import { useMemo, useState } from "react";
import type { AuditReport } from "@ether-hunt/shared";
import { AllowanceGraph } from "./AllowanceGraph";
import { RiskMeter } from "./RiskMeter";
import { downloadReportPdf } from "../lib/reportPdf";
import {
  copyShareText,
  nativeShare,
  shareOnX,
  shortAddr,
} from "../lib/reportShare";
import {
  findingIsActionable,
  revocableSpenders,
  revokeUrl,
  scoreReport,
} from "../lib/risk";

type Props = {
  report: AuditReport;
  focusEvidenceId: string | null;
  flashEvidenceId: string | null;
  onFocusEvidence: (id: string) => void;
};

export function Dossier({
  report,
  focusEvidenceId,
  flashEvidenceId,
  onFocusEvidence,
}: Props) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  const risk = useMemo(() => scoreReport(report), [report]);
  const spenders = useMemo(() => revocableSpenders(report), [report]);
  const payment = report.sources.payment;

  return (
    <section className="dossier" id="dossier">
      <div className="container dossier-inner">
        <div
          className={
            report.sources.graph.live ? "dossier-stamp live" : "dossier-stamp dead"
          }
          aria-hidden="true"
        >
          {report.sources.graph.live ? "GRAPH LIVE" : "GRAPH OFF"}
        </div>

        <div className="dossier-head">
          <div className="dossier-head-text">
            <p className="section-label">Dossier</p>
            <h2 className="dossier-title">{report.summary}</h2>
            <div className="meta-strip">
              <div>
                <span>Subject</span>
                <code>{shortAddr(report.address)}</code>
              </div>
              <div>
                <span>Payment</span>
                <code>{payment.rail}</code>
              </div>
              <div>
                <span>Evidence</span>
                <code>{report.evidence.length}</code>
              </div>
              <div>
                <span>Report</span>
                <code>{report.id.slice(0, 8)}</code>
              </div>
            </div>
          </div>
          <RiskMeter risk={risk} />
        </div>

        {spenders.length ? (
          <div className="remediation">
            <div className="remediation-head">
              <p className="section-label">Remediation queue</p>
              <a
                className="remediation-all"
                href={revokeUrl(report.address)}
                target="_blank"
                rel="noreferrer"
              >
                Open all in revoke.cash
              </a>
            </div>
            <ul className="spender-list">
              {spenders.slice(0, 6).map((s) => (
                <li key={s.spender} className={s.unlimited ? "unlimited" : undefined}>
                  <button type="button" onClick={() => onFocusEvidence(s.evidenceId)}>
                    <code>{shortAddr(s.spender)}</code>
                    <span className="spender-tag">
                      {s.unlimited ? "unlimited allowance" : "capped allowance"}
                    </span>
                  </button>
                  <a
                    href={`https://etherscan.io/address/${s.spender}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect
                  </a>
                </li>
              ))}
            </ul>
            <p className="remediation-note">
              Ranked by allowance exposure. Revoking removes the spender's right
              to move tokens without a new signature.
            </p>
          </div>
        ) : null}

        <div className="dossier-actions">
          <button
            type="button"
            className="action primary"
            onClick={() => {
              try {
                downloadReportPdf(report);
                setShareNote("Print dialog opened — choose Save as PDF.");
              } catch (err) {
                setShareNote(
                  err instanceof Error ? err.message : "PDF export failed",
                );
              }
            }}
          >
            Export PDF
          </button>
          <button
            type="button"
            className="action"
            onClick={() => {
              shareOnX(report);
              setShareNote("Opened X / Twitter share draft.");
            }}
          >
            Share on X
          </button>
          <button
            type="button"
            className="action"
            onClick={() => {
              void copyShareText(report)
                .then(() => setShareNote("Share text copied."))
                .catch(() => setShareNote("Clipboard blocked."));
            }}
          >
            Copy text
          </button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              type="button"
              className="action"
              onClick={() => {
                void nativeShare(report)
                  .then((ok) => {
                    if (ok) setShareNote("Shared.");
                  })
                  .catch(() => setShareNote("Share cancelled."));
              }}
            >
              Share…
            </button>
          ) : null}
          {shareNote ? (
            <span className="action-note" role="status">
              {shareNote}
            </span>
          ) : null}
        </div>

        {report.ai ? (
          <article className="ai-brief">
            <header>
              <p className="section-label">
                AI brief {report.ai.enabled ? "· Graph-grounded" : "· offline"}
              </p>
              {report.ai.model ? (
                <span className="model">{report.ai.model}</span>
              ) : null}
            </header>
            <p>{report.ai.narrative}</p>
            <p className="ai-guard">{report.ai.note}</p>
          </article>
        ) : null}

        <div className="monitor-frame">
          <div className="monitor-chrome">
            <span className="monitor-tag">
              TACTICAL THREAT MONITOR // LIVE GRAPH FEED
            </span>
          </div>
          <AllowanceGraph
            address={report.address}
            evidence={report.evidence}
            onSelect={onFocusEvidence}
          />
        </div>

        <div className="split">
          <section>
            <p className="section-label">Findings</p>
            <div className="findings">
              {report.findings.map((f) => (
                <article
                  className={
                    focusEvidenceId && f.evidenceIds.includes(focusEvidenceId)
                      ? `finding sev-${f.severity} finding-focus`
                      : `finding sev-${f.severity}`
                  }
                  key={f.id}
                  id={`finding-${f.id}`}
                  onClick={() => {
                    const id = f.evidenceIds[0];
                    if (id) onFocusEvidence(id);
                  }}
                >
                  <header>
                    <h3>{f.title}</h3>
                    <span className={`sev ${f.severity}`}>{f.severity}</span>
                  </header>
                  <p>{f.summary}</p>
                  <p className="rec">{f.recommendation}</p>
                  <footer className="finding-foot">
                    <span className="conf">
                      {(f.confidence * 100).toFixed(0)}% confidence ·{" "}
                      {f.evidenceIds.length} cites
                    </span>
                    {findingIsActionable(f, report.evidence) ? (
                      <a
                        href={revokeUrl(report.address)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Revoke →
                      </a>
                    ) : null}
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section>
            <p className="section-label">Evidence ledger</p>
            <div className="evidence">
              {report.evidence.map((e) => (
                <article
                  key={e.id}
                  id={`evidence-${e.id}`}
                  className={
                    flashEvidenceId === e.id
                      ? "evidence-focus flash"
                      : focusEvidenceId === e.id
                        ? "evidence-focus"
                        : undefined
                  }
                  onClick={() => onFocusEvidence(e.id)}
                >
                  <header>
                    <span className="kind">{e.kind}</span>
                    <h4>{e.title}</h4>
                  </header>
                  <p>{e.detail}</p>
                  <p className="ev-meta">
                    {e.occurredAt ? (
                      <time dateTime={e.occurredAt}>
                        {new Date(e.occurredAt).toLocaleString()}
                      </time>
                    ) : null}
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        Open explorer
                      </a>
                    ) : null}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <p className="graph-note">{report.sources.graph.note}</p>
      </div>
    </section>
  );
}
