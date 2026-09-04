import { jsPDF } from "jspdf";
import type { AuditReport } from "@ether-hunt/shared";
import { countHigh, shortAddr } from "./reportShare";

const INK = "#152033";
const OXIDE = "#c45c26";
const MUTED = "#5d6b7c";
const SIGNAL = "#0b6e4f";

function wrap(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH = 5) {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

export function downloadReportPdf(report: AuditReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const maxW = pageW - margin * 2;
  let y = 18;

  doc.setFillColor(21, 32, 51);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ETHER HUNT", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("On-chain allowance dossier · Graph-grounded", margin, 19);
  doc.setTextColor(196, 92, 38);
  doc.setFontSize(8);
  doc.text(report.id.slice(0, 8).toUpperCase(), pageW - margin, 12, {
    align: "right",
  });

  y = 38;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  y = wrap(doc, report.summary, margin, y, maxW, 6);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  const meta = [
    `Subject  ${report.address}`,
    `Network  ${report.networkLabel} (chain ${report.chainId})`,
    `Created  ${new Date(report.createdAt).toISOString()}`,
    `Graph    ${report.sources.graph.live ? "LIVE" : "OFF"} · ${report.sources.graph.note}`,
    `Payment  ${report.sources.payment.rail} · ${report.sources.payment.note}`,
    `Counts   findings=${report.findings.length} · high+=${countHigh(report)} · evidence=${report.evidence.length}`,
  ];
  for (const line of meta) {
    y = wrap(doc, line, margin, y, maxW, 4.5);
  }
  y += 6;

  if (report.ai?.narrative) {
    doc.setTextColor(SIGNAL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("AI brief", margin, y);
    y += 6;
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y = wrap(doc, report.ai.narrative, margin, y, maxW, 4.6);
    if (report.ai.model) {
      doc.setTextColor(MUTED);
      y = wrap(doc, `Model: ${report.ai.model} · ${report.ai.note}`, margin, y, maxW, 4.5);
    }
    y += 6;
  }

  doc.setTextColor(OXIDE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Findings", margin, y);
  y += 7;

  for (const f of report.findings) {
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    y = wrap(doc, `[${f.severity.toUpperCase()}] ${f.title}`, margin, y, maxW, 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    y = wrap(doc, f.summary, margin, y, maxW, 4.3);
    y = wrap(doc, `Rec: ${f.recommendation}`, margin, y, maxW, 4.3);
    y = wrap(
      doc,
      `Confidence ${(f.confidence * 100).toFixed(0)}% · cites ${f.evidenceIds.join(", ") || "—"}`,
      margin,
      y,
      maxW,
      4.3,
    );
    y += 4;
  }

  if (y > 250) {
    doc.addPage();
    y = 18;
  }
  doc.setTextColor(OXIDE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Evidence ledger", margin, y);
  y += 7;

  for (const e of report.evidence) {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    y = wrap(doc, `${e.kind.toUpperCase()} · ${e.title}`, margin, y, maxW, 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    y = wrap(doc, e.detail, margin, y, maxW, 4.2);
    if (e.url) y = wrap(doc, e.url, margin, y, maxW, 4.2);
    y += 3.5;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(
      `Ether Hunt · ${shortAddr(report.address)} · page ${i}/${pages}`,
      margin,
      290,
    );
  }

  const name = `ether-hunt-${shortAddr(report.address).replace("…", "-")}-${report.id.slice(0, 8)}.pdf`;
  doc.save(name);
}
