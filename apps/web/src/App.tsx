import { useEffect, useState, type FormEvent } from "react";
import type { AuditReport } from "@ether-hunt/shared";
import { downloadReportPdf } from "./reportPdf";
import {
  copyShareText,
  nativeShare,
  shareOnX,
  shortAddr,
} from "./reportShare";

const API = "/api";

type PayRail = "local" | "hedera" | "arc";

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
    hint: "Unpaid UI scan — not for prize demos",
  },
  {
    id: "hedera",
    label: "Hedera x402",
    hint: "Agent USDC via Blocky402",
  },
  {
    id: "arc",
    label: "Arc Agent",
    hint: "Circle Gateway nanopayment",
  },
];

function endpointFor(rail: PayRail) {
  if (rail === "hedera") return `${API}/scan/hedera`;
  if (rail === "arc") return `${API}/scan/arc`;
  return `${API}/scan/local`;
}

function busyLabel(rail: PayRail) {
  if (rail === "hedera") return "Settling Hedera USDC…";
  if (rail === "arc") return "Paying Arc Gateway…";
  return "Hunting…";
}

export function App() {
  const [address, setAddress] = useState(DEMO_ADDRESSES[0].value);
  const [rail, setRail] = useState<PayRail>("hedera");
  const [bypassOn, setBypassOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

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
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };

      const response = await fetch(endpointFor(rail), {
        method: "POST",
        headers,
        body: JSON.stringify({ chainId: 1, address }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.message ?? payload.error ?? `HTTP ${response.status}`,
        );
      }
      setReport(payload as AuditReport);
    } catch (err) {
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

  const huntLabel =
    rail === "local" ? "Hunt" : rail === "hedera" ? "Pay & hunt" : "Pay & hunt";

  return (
    <div className="page">
      <div className="grid-bg" aria-hidden="true" />
      <div className="shell">
        <header className="hero">
          <div className="brand-row">
            <img
              className="brand-mark"
              src="/logo-192.png"
              width={56}
              height={56}
              alt=""
            />
            <div>
              <p className="kicker">On-chain allowance hunt</p>
              <h1 className="brand">Ether Hunt</h1>
            </div>
          </div>
          <p className="tagline">
            Live Graph evidence. Grounded AI findings. Pay-per-scan.
          </p>
          <p className="rail">
            Hedera x402 <span>·</span> The Graph AI <span>·</span> Arc Agent
            Stack
          </p>
        </header>

        <fieldset className="pay-rails">
          <legend>Payment rail</legend>
          <div className="pay-options">
            {RAILS.map((option) => (
              <label
                key={option.id}
                className={
                  rail === option.id ? "pay-option active" : "pay-option"
                }
              >
                <input
                  type="radio"
                  name="pay-rail"
                  value={option.id}
                  checked={rail === option.id}
                  onChange={() => setRail(option.id)}
                />
                <span className="pay-label">{option.label}</span>
                <span className="pay-hint">{option.hint}</span>
              </label>
            ))}
          </div>
          {bypassOn && rail !== "local" ? (
            <p className="pay-warn">
              Global DEV_BYPASS_PAYMENT is on — Hedera/Arc will not truly settle
              until you set it to false and restart the API.
            </p>
          ) : null}
          {rail === "local" ? (
            <p className="pay-hint-inline">
              Local is always unpaid (`dev-bypass`). Prize settles use Hedera or
              Arc.
            </p>
          ) : null}
        </fieldset>

        <form className="scan" onSubmit={onScan}>
          <label className="field">
            <span>Target address</span>
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
        </form>

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
              onClick={() => setAddress(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {error ? <p className="status error">{error}</p> : null}
        {!error && !report && !busy ? (
          <p className="status">
            Incident wallets below are public Etherscan-tagged exploit
            addresses. Dense USDC still gives the richest Graph dossier for
            demos.
          </p>
        ) : null}
        {busy ? (
          <p className="status hunting" role="status">
            {rail === "local"
              ? "Tracing approvals across Graph evidence…"
              : `${busyLabel(rail)} then grounding the dossier…`}
          </p>
        ) : null}

        {report ? (
          <section className="dossier">
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
                    setShareNote("PDF downloaded.");
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
                    <article key={e.id}>
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
          </section>
        ) : null}
      </div>
    </div>
  );
}
