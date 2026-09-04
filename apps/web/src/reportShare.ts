import type { AuditReport } from "@ether-hunt/shared";

export function shortAddr(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function countHigh(report: AuditReport) {
  return report.findings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  ).length;
}

export function buildShareText(report: AuditReport) {
  const high = countHigh(report);
  const rail = report.sources.payment.rail;
  const graph = report.sources.graph.live ? "live Graph" : "offline Graph";
  return [
    `Ether Hunt dossier on ${shortAddr(report.address)}:`,
    `${high} high/critical · ${report.findings.length} findings · ${graph}.`,
    `Rail: ${rail}.`,
    `#EtherHunt #ETHOnline #x402`,
  ].join(" ");
}

export function shareOnX(report: AuditReport) {
  const text = buildShareText(report);
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

export async function copyShareText(report: AuditReport) {
  const text = buildShareText(report);
  await navigator.clipboard.writeText(text);
  return text;
}

export async function nativeShare(report: AuditReport) {
  if (!navigator.share) return false;
  await navigator.share({
    title: `Ether Hunt · ${shortAddr(report.address)}`,
    text: buildShareText(report),
  });
  return true;
}
