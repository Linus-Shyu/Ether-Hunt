import { useState, type FormEvent } from "react";
import type { AuditReport } from "@ether-hunt/shared";

const API = "/api";

export function App() {
  const [address, setAddress] = useState(
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  async function onScan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch(`${API}/audit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ether-hunt-dev-bypass": "1",
        },
        body: JSON.stringify({ chainId: 1, address }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? payload.error ?? `HTTP ${response.status}`);
      }
      setReport(payload as AuditReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <h1 className="brand">Ether Hunt</h1>
        <p className="tagline">
          Evidence-backed AI audit: live Graph signals, grounded findings, pay-per-scan
          on Hedera x402 — with an Arc agent as the paying consumer.
        </p>
        <ul className="partners">
          <li>Hedera x402</li>
          <li>The Graph · From Scratch AI</li>
          <li>Arc Agent Stack</li>
        </ul>
      </header>

      <form className="scan" onSubmit={onScan}>
        <label>
          Contract / account address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error ? <p className="status error">{error}</p> : null}
      {!error && !report ? (
        <p className="status">
          Local dev uses payment bypass. Prize demos must settle real Hedera x402 + live
          Graph data.
        </p>
      ) : null}

      {report ? (
        <section className="report">
          <div className="panel">
            <h2>Report</h2>
            <p>{report.summary}</p>
            <div className="meta">
              <span>
                <strong>Address</strong> {report.address}
              </span>
              <span>
                <strong>Graph</strong>{" "}
                {report.sources.graph.live ? "live" : "not live"} —{" "}
                {report.sources.graph.note}
              </span>
              <span>
                <strong>Payment</strong> {report.sources.payment.rail}
              </span>
            </div>
          </div>

          <div className="panel">
            <h2>Findings</h2>
            <div className="findings">
              {report.findings.map((f) => (
                <article className="finding" key={f.id}>
                  <header>
                    <h3>{f.title}</h3>
                    <span className={`sev ${f.severity}`}>{f.severity}</span>
                  </header>
                  <p>{f.summary}</p>
                  <p>{f.recommendation}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Evidence</h2>
            <div className="evidence">
              {report.evidence.map((e) => (
                <article key={e.id}>
                  <h4>
                    [{e.kind}] {e.title}
                  </h4>
                  <p>{e.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
