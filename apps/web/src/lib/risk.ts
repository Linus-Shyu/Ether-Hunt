import type { AuditReport, EvidenceItem, Finding, Severity } from "@ether-hunt/shared";

const WEIGHTS: Record<Severity, number> = {
  critical: 42,
  high: 26,
  medium: 11,
  low: 4,
  info: 1,
};

export type RiskBand = "clear" | "low" | "elevated" | "high" | "critical";

export type RiskScore = {
  score: number;
  band: RiskBand;
  label: string;
  counts: Record<Severity, number>;
};

/**
 * Exposure score from rule + AI findings. Weighted so one critical dominates
 * a pile of info rows — the same ordering a human triager would use.
 */
export function scoreReport(report: AuditReport): RiskScore {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of report.findings) counts[f.severity] += 1;

  const raw = report.findings.reduce(
    (sum, f) => sum + WEIGHTS[f.severity] * (0.6 + 0.4 * f.confidence),
    0,
  );
  const score = Math.min(100, Math.round(raw));

  // "Critical" is reserved for an actual critical finding — a pile of
  // unlimited approvals is high exposure, not a confirmed compromise.
  const band: RiskBand =
    score === 0
      ? "clear"
      : score < 25
        ? "low"
        : score < 50
          ? "elevated"
          : score < 75 || counts.critical === 0
            ? "high"
            : "critical";

  const label =
    band === "clear"
      ? "No exposure detected"
      : band === "low"
        ? "Low exposure"
        : band === "elevated"
          ? "Elevated exposure"
          : band === "high"
            ? "High exposure"
            : "Critical exposure";

  return { score, band, label, counts };
}

/** Spenders the subject granted allowance to — the revocation worklist. */
export function revocableSpenders(report: AuditReport): Array<{
  spender: string;
  unlimited: boolean;
  evidenceId: string;
}> {
  const subject = report.address.toLowerCase();
  const seen = new Set<string>();
  const out: Array<{ spender: string; unlimited: boolean; evidenceId: string }> = [];

  for (const e of report.evidence) {
    const links = e.links;
    if (!links?.spender || links.owner?.toLowerCase() !== subject) continue;
    const spender = links.spender.toLowerCase();
    if (seen.has(spender)) continue;
    seen.add(spender);
    out.push({
      spender,
      unlimited: Boolean(links.unlimited),
      evidenceId: e.id,
    });
  }
  return out;
}

/**
 * Live subgraph rows carry their raw `ApprovalEvent` entity id. Synthetic rows
 * (RPC fallback, address profile, Graph error states) use reserved prefixes.
 */
const SYNTHETIC_PREFIXES = ["rpc-", "addr-profile", "graph-"];

export function countGraphRows(report: AuditReport): number {
  return report.evidence.filter(
    (e) => !SYNTHETIC_PREFIXES.some((p) => e.id.startsWith(p)),
  ).length;
}

export function revokeUrl(owner: string): string {
  return `https://revoke.cash/address/${owner}?chainId=1`;
}

/** Findings that cite at least one approval edge, so a revoke CTA makes sense. */
export function findingIsActionable(
  finding: Finding,
  evidence: EvidenceItem[],
): boolean {
  return finding.evidenceIds.some((id) => {
    const item = evidence.find((e) => e.id === id);
    return Boolean(item?.links?.spender);
  });
}
