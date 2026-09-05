import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AuditReport } from "@ether-hunt/shared";
import { AllowanceGraph } from "./AllowanceGraph";
import { downloadReportPdf } from "./reportPdf";
import {
  flowStepsFor,
  gatedProbePath,
  paidScanPath,
  stepIndex,
  type FlowStepId,
  type PayRail,
} from "./paymentFlow";
import {
  copyShareText,
  nativeShare,
  shareOnX,
  shortAddr,
} from "./reportShare";

const API = "/api";

const DEMO_ADDRESSES = [
  {
    label: "Dense USDC (demo)",
    value: "0x0218033bc4c88e91a6cc9a6aceee421dda39448d",
  },
  {
    label: "Ronin Bridge ’22",
    value: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
  },
  {
    label: "Poly Network ’21",
    value: "0xC8a65Fadf0e0dDAf421F28FEAb69Bf6E2E589963",
  },
  {
    label: "Nomad Bridge ’22",
    value: "0x56D8B635A7C88Fd1104D23d632AF40c1C3Aac4e3",
  },
  {
    label: "Beanstalk ’22",
    value: "0x1c5dCdd006EA78a7E4783f9e6021C32935a10fb4",
  },
  {
    label: "BadgerDAO ’21",
    value: "0x1FCdb04d0C5364FBd92C73cA8AF9BAA72c269107",
  },
  {
    label: "Euler Finance ’23",
    value: "0xb66cd966670d962C227B3eABA30a872DbFB995db",
  },
  {
    label: "Bybit cold wallet ’25",
    value: "0x47666Fab8bd0Ac7003bce3f5C3585383F09486E2",
  },
  {
    label: "vitalik.eth",
    value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
];

const RAILS: { id: PayRail; label: string; hint: string }[] = [
  {
    id: "local",
    label: "Local",
    hint: "Unpaid UI scan",
  },
  {
    id: "hedera",
    label: "Hedera x402",
    hint: "Blocky402 USDC",
  },
  {
    id: "arc",
    label: "Arc Agent",
    hint: "Circle Gateway",
  },
];

function busyLabel(rail: PayRail) {
  if (rail === "hedera") return "Settling Hedera USDC…";
  if (rail === "arc") return "Paying Arc Gateway…";
  return "Hunting…";
}

type FlowPhase = "idle" | "running" | "done" | "error";

export function App() {
  const [address, setAddress] = useState(DEMO_ADDRESSES[0].value);
  const [rail, setRail] = useState<PayRail>("hedera");
  const [bypassOn, setBypassOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeStep, setActiveStep] = useState<FlowStepId>("request");
  const [flowNote, setFlowNote] = useState<string | null>(null);
  const [focusEvidenceId, setFocusEvidenceId] = useState<string | null>(null);

  const steps = useMemo(() => flowStepsFor(rail), [rail]);
  const activeIdx = stepIndex(steps, activeStep);
  const progressPct =
    flowPhase === "idle"
      ? 0
      : flowPhase === "done"
        ? 100
        : Math.min(96, ((activeIdx + 0.45) / steps.length) * 100);

  useEffect(() => {
    setFlowPhase("idle");
    setActiveStep("request");
    setFlowNote(null);
  }, [rail]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((h: { x402?: { bypass?: boolean } }) => {
        if (!cancelled) setBypassOn(Boolean(h.x402?.bypass));
      })
      .catch(() => {
        if (!cancelled) setBypassOn(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onScan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReport(null);
    setShareNote(null);
    setFlowPhase("running");
    setFlowNote(null);
    setActiveStep("request");
    setFocusEvidenceId(null);

    const body = JSON.stringify({ chainId: 1, address });

    try {
      if (rail === "local") {
        setActiveStep("scan");
        setFlowNote("Unpaid local path — Graph + AI only");
        const response = await fetch(`${API}/scan/local`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.message ?? payload.error ?? `HTTP ${response.status}`,
          );
        }
        setActiveStep("ready");
        setFlowPhase("done");
        setFlowNote("dev-bypass · not a prize settle");
        setReport(payload as AuditReport);
      } else {
        setActiveStep("challenge");
        if (bypassOn) {
          setFlowNote(
            "DEV_BYPASS_PAYMENT is on — no live 402 (turn off for prize demos)",
          );
          await new Promise((r) => setTimeout(r, 400));
        } else {
          setFlowNote("Probing gated endpoint for HTTP 402…");
          const probe = await fetch(gatedProbePath(rail), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
          if (probe.status === 402) {
            setFlowNote("HTTP 402 Payment Required — agent will settle");
            await new Promise((r) => setTimeout(r, 500));
          } else if (probe.ok) {
            setFlowNote(
              "Gate returned 200 unexpectedly — continuing buyer path",
            );
            await new Promise((r) => setTimeout(r, 350));
          } else {
            const fail = await probe.json().catch(() => ({}));
            throw new Error(
              fail.message ?? fail.error ?? `Probe HTTP ${probe.status}`,
            );
          }
        }

        setActiveStep("settle");
        setFlowNote(
          rail === "hedera"
            ? "Hedera agent signing USDC via Blocky402…"
            : "Circle agent paying Arc Gateway…",
        );

        const response = await fetch(paidScanPath(rail), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });

        setActiveStep("scan");
        setFlowNote("Settlement path returned — assembling Graph dossier…");

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.message ?? payload.error ?? `HTTP ${response.status}`,
          );
        }

        const paid = payload as AuditReport;
        setActiveStep("ready");
        setFlowPhase("done");
        setFlowNote(
          `${paid.sources.payment.rail} · settled=${String(paid.sources.payment.settled)}`,
        );
        setReport(paid);
      }

      requestAnimationFrame(() => {
        document
          .getElementById("dossier")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setFlowPhase("error");
      setFlowNote(err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const high =
    report?.findings.filter(
      (f) => f.severity === "high" || f.severity === "critical",
    ).length ?? 0;
  const medium =
    report?.findings.filter((f) => f.severity === "medium").length ?? 0;

  const huntLabel = rail === "local" ? "Begin hunt" : "Pay & hunt";

  return (
    <div className={report ? "page has-report" : "page"}>
      <div className="atmosphere" aria-hidden="true">
        <img className="field" src="/hero-field.svg" alt="" />
        <div className="scope-spin" />
        <div className="mist" />
      </div>

      <section className="stage">
        <div className="stage-inner">
          <p className="brand-mark-line">
            <img src="/logo-192.png" width={36} height={36} alt="" />
            <span>ETHOnline 2026 · Classic</span>
          </p>

          <h1 className="brand">
            <span className="brand-ether">Ether</span>
            <span className="brand-hunt">Hunt</span>
          </h1>

          <p className="lede">
            Trace live Graph approvals. Ground the AI. Settle the scan.
          </p>

          <form className="cta" onSubmit={onScan}>
            <div
              className="rail-tabs"
              role="radiogroup"
              aria-label="Payment rail"
            >
              {RAILS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={rail === option.id}
                  className={rail === option.id ? "rail-tab active" : "rail-tab"}
                  onClick={() => setRail(option.id)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="cta-row">
              <label className="target">
                <span>Target</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <button className="hunt" type="submit" disabled={busy}>
                {busy ? busyLabel(rail) : huntLabel}
              </button>
            </div>

            {bypassOn && rail !== "local" ? (
              <p className="cta-note warn">
                DEV_BYPASS_PAYMENT is on — flip false for a real settle.
              </p>
            ) : null}
            {rail === "local" ? (
              <p className="cta-note">Local scans are unpaid (dev-bypass).</p>
            ) : (
              <p className="cta-note">
                {RAILS.find((r) => r.id === rail)?.hint} · agent wallet on API
                host
              </p>
            )}

            {flowPhase !== "idle" ? (
              <div
                className={`pay-flow ${flowPhase} steps-${steps.length}`}
                role="status"
                aria-live="polite"
              >
                <div className="pay-flow-top">
                  <span className="pay-flow-label">
                    {rail === "local" ? "Scan progress" : "Payment progress"}
                  </span>
                  <span className="pay-flow-pct">
                    {flowPhase === "error"
                      ? "failed"
                      : `${Math.round(progressPct)}%`}
                  </span>
                </div>
                <div className="pay-track" aria-hidden="true">
                  <div
                    className="pay-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <ol className="pay-steps">
                  {steps.map((step, i) => {
                    const state =
                      flowPhase === "error" && i === activeIdx
                        ? "error"
                        : i < activeIdx || flowPhase === "done"
                          ? "done"
                          : i === activeIdx
                            ? "active"
                            : "todo";
                    return (
                      <li key={step.id} className={`pay-step ${state}`}>
                        <span className="pay-step-dot" />
                        <span className="pay-step-label">{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="pay-flow-note">
                  {flowNote ??
                    steps[activeIdx]?.detail ??
                    "Waiting for payment flow…"}
                </p>
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="cases">
        <div className="cases-inner">
          <header>
            <p className="section-label">Case files</p>
            <h2>Known incident wallets</h2>
            <p>
              Public exploit addresses for quick demos. Dense USDC still yields
              the richest Graph dossier.
            </p>
          </header>
          <div className="presets">
            {DEMO_ADDRESSES.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={
                  address.toLowerCase() === preset.value.toLowerCase()
                    ? "preset active"
                    : "preset"
                }
                onClick={() => {
                  setAddress(preset.value);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="shell status-shell">
        {error ? <p className="status error">{error}</p> : null}
      </div>

      {report ? (
        <section className="dossier" id="dossier">
          <div className="dossier-inner">
            <div className="dossier-stamp" aria-hidden="true">
              {report.sources.graph.live ? "GRAPH LIVE" : "GRAPH OFF"}
            </div>

            <div className="dossier-head">
              <div>
                <p className="section-label">Dossier</p>
                <h2>{report.summary}</h2>
              </div>
              <dl className="counters">
                <div>
                  <dt>Findings</dt>
                  <dd>{report.findings.length}</dd>
                </div>
                <div>
                  <dt>High+</dt>
                  <dd className="hot">{high}</dd>
                </div>
                <div>
                  <dt>Medium</dt>
                  <dd>{medium}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{report.evidence.length}</dd>
                </div>
              </dl>
            </div>

            <div className="meta-strip">
              <div>
                <span>Subject</span>
                <code>{shortAddr(report.address)}</code>
              </div>
              <div>
                <span>Graph</span>
                <strong className={report.sources.graph.live ? "live" : "dead"}>
                  {report.sources.graph.live ? "LIVE" : "OFF"}
                </strong>
              </div>
              <div>
                <span>Payment</span>
                <code>{report.sources.payment.rail}</code>
              </div>
              <div>
                <span>Report</span>
                <code>{report.id.slice(0, 8)}</code>
              </div>
            </div>

            <div className="dossier-actions">
              <button
                type="button"
                className="action primary"
                onClick={() => {
                  try {
                    downloadReportPdf(report);
                    setShareNote(
                      "Print dialog opened — choose Save as PDF.",
                    );
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
                    AI brief{" "}
                    {report.ai.enabled ? "· Graph-grounded" : "· offline"}
                  </p>
                  {report.ai.model ? (
                    <span className="model">{report.ai.model}</span>
                  ) : null}
                </header>
                <p>{report.ai.narrative}</p>
              </article>
            ) : null}

            <AllowanceGraph
              address={report.address}
              evidence={report.evidence}
              onSelect={(id) => {
                setFocusEvidenceId(id);
                requestAnimationFrame(() => {
                  document
                    .getElementById(`evidence-${id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                });
              }}
            />

            <div className="split">
              <section>
                <p className="section-label">Findings</p>
                <div className="findings">
                  {report.findings.map((f) => (
                    <article className={`finding sev-${f.severity}`} key={f.id}>
                      <header>
                        <h3>{f.title}</h3>
                        <span className={`sev ${f.severity}`}>{f.severity}</span>
                      </header>
                      <p>{f.summary}</p>
                      <p className="rec">{f.recommendation}</p>
                      <p className="conf">
                        {(f.confidence * 100).toFixed(0)}% confidence ·{" "}
                        {f.evidenceIds.length} cites
                      </p>
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
                        focusEvidenceId === e.id ? "evidence-focus" : undefined
                      }
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
                          <a href={e.url} target="_blank" rel="noreferrer">
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
      ) : null}

      <footer className="site-foot">
        <span>Ether Hunt</span>
        <span>Hedera x402 · The Graph · Arc Agent Stack</span>
      </footer>
    </div>
  );
}
