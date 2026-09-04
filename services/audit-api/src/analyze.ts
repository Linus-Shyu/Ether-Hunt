import type { EvidenceItem, Finding } from "@ether-hunt/shared";
import { randomUUID } from "node:crypto";

/**
 * Deterministic first-pass analysis (no LLM required for local demo).
 * LLM synthesis can wrap these findings later — citations stay mandatory.
 */
export function analyzeEvidence(evidence: EvidenceItem[]): Finding[] {
  const findings: Finding[] = [];

  for (const item of evidence) {
    if (item.kind !== "approval") continue;
    const unlimited = /unlimited/i.test(item.title) || /f{20,}/i.test(item.detail);
    if (!unlimited) continue;

    findings.push({
      id: randomUUID(),
      title: "Unlimited token approval",
      severity: "high",
      confidence: 0.82,
      summary: item.detail,
      recommendation:
        "Revoke unused allowances and prefer Permit2 / exact allowances over infinite approvals.",
      evidenceIds: [item.id],
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: randomUUID(),
      title: "No high-severity approval patterns detected",
      severity: "info",
      confidence: 0.55,
      summary:
        "First-pass rules found no unlimited approvals in the Graph evidence set. Expand detectors (roles, pause, proxies) next.",
      recommendation:
        "Keep monitoring; wire access-control and upgradeability detectors when schema supports them.",
      evidenceIds: evidence.slice(0, 3).map((e) => e.id),
    });
  }

  return findings;
}

export function summarizeFindings(findings: Finding[]): string {
  const high = findings.filter((f) =>
    f.severity === "critical" || f.severity === "high",
  ).length;
  if (high > 0) {
    return `${high} high-or-critical finding(s). Review approvals and privileged paths before interacting.`;
  }
  return "No high-severity findings in the current detector set. Graph evidence still attached for review.";
}
