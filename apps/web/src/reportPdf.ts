import type { AuditReport } from "@ether-hunt/shared";
import { countHigh, shortAddr } from "./reportShare";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(report: AuditReport) {
  const high = countHigh(report);
  const medium = report.findings.filter((f) => f.severity === "medium").length;
  const created = new Date(report.createdAt).toLocaleString();

  const findings = report.findings
    .map(
      (f) => `
      <article class="finding sev-${esc(f.severity)}">
        <header>
          <h3>${esc(f.title)}</h3>
          <span class="sev">${esc(f.severity)}</span>
        </header>
        <p>${esc(f.summary)}</p>
        <p class="rec">${esc(f.recommendation)}</p>
        <p class="meta">${(f.confidence * 100).toFixed(0)}% confidence · ${f.evidenceIds.length} cites</p>
      </article>`,
    )
    .join("");

  const evidence = report.evidence
    .map(
      (e) => `
      <article class="evidence-row">
        <header>
          <span class="kind">${esc(e.kind)}</span>
          <h4>${esc(e.title)}</h4>
        </header>
        <p>${esc(e.detail)}</p>
        ${
          e.url
            ? `<p class="meta"><a href="${esc(e.url)}">${esc(e.url)}</a></p>`
            : ""
        }
      </article>`,
    )
    .join("");

  const ai = report.ai
    ? `
    <section class="ai">
      <p class="label">AI brief ${report.ai.enabled ? "· Graph-grounded" : "· offline"}</p>
      ${report.ai.model ? `<p class="model">${esc(report.ai.model)}</p>` : ""}
      <p class="narrative">${esc(report.ai.narrative)}</p>
    </section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ether Hunt · ${esc(shortAddr(report.address))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #132033;
      --muted: #5a6a7c;
      --oxide: #c24f1d;
      --signal: #0a6b4d;
      --danger: #b42318;
      --warn: #9a6700;
      --line: rgba(19,32,51,.14);
      --paper: #f4f7fa;
      --display: "Bricolage Grotesque", sans-serif;
      --body: "Source Serif 4", Georgia, serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    @page { margin: 14mm 14mm 16mm; }
    html, body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: var(--body);
    }
    body { padding: 0; }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      padding: 28px 32px 40px;
      position: relative;
    }
    .mast {
      background: var(--ink);
      color: #f7fafc;
      margin: -28px -32px 28px;
      padding: 22px 32px 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
    }
    .mast h1 {
      margin: 0;
      font-family: var(--display);
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.045em;
      line-height: 0.9;
    }
    .mast h1 span { color: #e07a45; }
    .mast .sub {
      margin: 8px 0 0;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .stamp {
      border: 1.5px solid var(--signal);
      color: #7dceb0;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 6px 8px;
      transform: rotate(8deg);
      white-space: nowrap;
    }
    .summary {
      margin: 0 0 18px;
      font-family: var(--display);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .grid div {
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .grid dt {
      margin: 0;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .grid dd {
      margin: 4px 0 0;
      font-family: var(--display);
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .grid .hot { color: var(--danger); }
    .meta {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 6px 12px;
      margin: 0 0 22px;
      font-size: 13px;
    }
    .meta .k {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      padding-top: 2px;
    }
    .meta .v {
      font-family: var(--mono);
      font-size: 12px;
      word-break: break-word;
    }
    .label {
      margin: 0 0 8px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--oxide);
    }
    .ai {
      margin: 0 0 26px;
      padding-left: 14px;
      border-left: 3px solid var(--signal);
    }
    .ai .model {
      margin: 0 0 6px;
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
    }
    .narrative {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
    }
    .cols {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 28px;
    }
    .finding, .evidence-row {
      break-inside: avoid;
      margin-bottom: 14px;
      padding-left: 12px;
      border-left: 3px solid var(--line);
    }
    .finding.sev-high, .finding.sev-critical { border-left-color: var(--danger); }
    .finding.sev-medium { border-left-color: var(--warn); }
    .finding.sev-info, .finding.sev-low { border-left-color: var(--signal); }
    .finding header, .evidence-row header {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
    }
    .finding h3, .evidence-row h4 {
      margin: 0;
      font-family: var(--display);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .sev, .kind {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .kind { color: var(--oxide); }
    .finding p, .evidence-row p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .rec { color: var(--ink) !important; }
    .meta, .finding .meta, .evidence-row .meta {
      font-family: var(--mono);
      font-size: 11px !important;
      color: var(--muted) !important;
    }
    a { color: var(--signal); word-break: break-all; }
    .foot {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      font-family: var(--mono);
      font-size: 10px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 12px 16px;
      background: rgba(244,247,250,.92);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(6px);
    }
    .toolbar button {
      border: 0;
      border-radius: 2px;
      padding: 10px 14px;
      font-family: var(--display);
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      background: var(--oxide);
      color: #fff7f0;
    }
    .toolbar button.ghost {
      background: transparent;
      color: var(--ink);
      border: 1.5px solid var(--ink);
    }
    @media print {
      .toolbar { display: none !important; }
      body { background: white; }
      .sheet { max-width: none; padding: 0; }
      .mast { margin: 0 0 18px; }
      .cols { gap: 18px; }
    }
    @media (max-width: 720px) {
      .cols, .grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="ghost" type="button" onclick="window.close()">Close</button>
    <button type="button" onclick="window.print()">Save as PDF</button>
  </div>
  <div class="sheet">
    <header class="mast">
      <div>
        <h1>Ether <span>Hunt</span></h1>
        <p class="sub">On-chain allowance dossier · Graph-grounded</p>
      </div>
      <div class="stamp">${report.sources.graph.live ? "Graph live" : "Graph off"}</div>
    </header>

    <p class="summary">${esc(report.summary)}</p>

    <dl class="grid">
      <div><dt>Findings</dt><dd>${report.findings.length}</dd></div>
      <div><dt>High+</dt><dd class="hot">${high}</dd></div>
      <div><dt>Medium</dt><dd>${medium}</dd></div>
      <div><dt>Evidence</dt><dd>${report.evidence.length}</dd></div>
    </dl>

    <div class="meta">
      <div class="k">Subject</div><div class="v">${esc(report.address)}</div>
      <div class="k">Network</div><div class="v">${esc(report.networkLabel)} (chain ${report.chainId})</div>
      <div class="k">Created</div><div class="v">${esc(created)}</div>
      <div class="k">Graph</div><div class="v">${report.sources.graph.live ? "LIVE" : "OFF"} — ${esc(report.sources.graph.note)}</div>
      <div class="k">Payment</div><div class="v">${esc(report.sources.payment.rail)} — ${esc(report.sources.payment.note)}</div>
      <div class="k">Report</div><div class="v">${esc(report.id)}</div>
    </div>

    ${ai}

    <div class="cols">
      <section>
        <p class="label">Findings</p>
        ${findings}
      </section>
      <section>
        <p class="label">Evidence ledger</p>
        ${evidence}
      </section>
    </div>

    <footer class="foot">
      <span>Ether Hunt · ${esc(shortAddr(report.address))}</span>
      <span>Hedera x402 · The Graph · Arc Agent Stack</span>
    </footer>
  </div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 350);
    });
  </script>
</body>
</html>`;
}

/**
 * Opens a brand-styled dossier print sheet.
 * Use the system dialog → "Save as PDF" for a typeset export
 * (matches site fonts; avoids Helvetica Unicode breakage).
 */
export function downloadReportPdf(report: AuditReport) {
  const html = buildReportHtml(report);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("Pop-up blocked — allow pop-ups to export the PDF dossier.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
