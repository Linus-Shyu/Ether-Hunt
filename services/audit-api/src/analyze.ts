import type { EvidenceItem, Finding } from "@ether-hunt/shared";
import { randomUUID } from "node:crypto";

const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";

function isApproval(item: EvidenceItem) {
  return item.kind === "approval";
}

function mentionsPermit2(item: EvidenceItem) {
  const hay = `${item.title} ${item.detail}`.toLowerCase();
  return (
    hay.includes(PERMIT2) ||
    hay.includes("permit2") ||
    hay.includes("0x0000…8ba3") ||
    hay.includes("0x000000000022d473")
  );
}

function isUnlimited(item: EvidenceItem) {
  return /unlimited/i.test(item.title) || /max uint256/i.test(item.detail);
}

function isRevoke(item: EvidenceItem) {
  return /revoked|value=0 \(revoked\)/i.test(item.title + item.detail);
}

function isContext(item: EvidenceItem) {
  return /network context/i.test(item.title);
}

function isSpenderRole(item: EvidenceItem) {
  return /is spender/i.test(item.title);
}

/**
 * Deterministic analysis over Graph (+ optional RPC) evidence.
 */
export function analyzeEvidence(evidence: EvidenceItem[]): Finding[] {
  const findings: Finding[] = [];
  const approvals = evidence.filter(isApproval);
  const subjectApprovals = approvals.filter((e) => !isContext(e));
  const unlimited = subjectApprovals.filter(isUnlimited);
  const revokes = subjectApprovals.filter(isRevoke);
  const permit2 = subjectApprovals.filter(mentionsPermit2);
  const asSpender = subjectApprovals.filter(isSpenderRole);
  const context = approvals.filter(isContext);

  for (const item of unlimited) {
    findings.push({
      id: randomUUID(),
      title: isSpenderRole(item)
        ? "Unlimited allowance granted TO this address"
        : "Unlimited token approval",
      severity: "high",
      confidence: 0.86,
      summary: item.detail,
      recommendation:
        "Revoke unused allowances. Prefer Permit2 / exact amounts over infinite approvals.",
      evidenceIds: [item.id],
    });
  }

  if (permit2.length > 0) {
    findings.push({
      id: randomUUID(),
      title: "Permit2 spender observed",
      severity: "medium",
      confidence: 0.78,
      summary: `${permit2.length} approval(s) involve Uniswap Permit2 (${PERMIT2.slice(0, 10)}…). Review which routers still hold allowance.`,
      recommendation:
        "Confirm Permit2 allowances are intentional; revoke stale operator approvals.",
      evidenceIds: permit2.slice(0, 5).map((e) => e.id),
    });
  }

  if (revokes.length > 0) {
    findings.push({
      id: randomUUID(),
      title: "Approval revocations present",
      severity: "low",
      confidence: 0.7,
      summary: `${revokes.length} revoke event(s) (value=0) in the evidence window — hygiene signal.`,
      recommendation: "Good practice; keep revoking after one-off integrations.",
      evidenceIds: revokes.slice(0, 5).map((e) => e.id),
    });
  }

  if (asSpender.length > 0 && unlimited.filter(isSpenderRole).length === 0) {
    findings.push({
      id: randomUUID(),
      title: "Address receives allowances as spender",
      severity: "medium",
      confidence: 0.72,
      summary: `${asSpender.length} approval(s) name this address as spender. Treat as privileged operator surface.`,
      recommendation:
        "If this is a router/vault, publish allowance policy; if EOA, investigate unexpected spend rights.",
      evidenceIds: asSpender.slice(0, 5).map((e) => e.id),
    });
  }

  const finite = subjectApprovals.filter(
    (e) => !isUnlimited(e) && !isRevoke(e) && !isSpenderRole(e),
  );
  if (finite.length > 0) {
    findings.push({
      id: randomUUID(),
      title: "Finite ERC-20 allowances",
      severity: "info",
      confidence: 0.74,
      summary: `${finite.length} non-unlimited approval(s) for this subject in the indexed window.`,
      recommendation: "Spot-check large finite allowances against expected dapp usage.",
      evidenceIds: finite.slice(0, 8).map((e) => e.id),
    });
  }

  if (context.length > 0 && subjectApprovals.length < 3) {
    findings.push({
      id: randomUUID(),
      title: "Sparse subject history — network risk context attached",
      severity: "info",
      confidence: 0.6,
      summary: `Subject has few indexed approvals; attached ${context.length} recent high-risk USDC approval(s) from the live subgraph as market context (not attributed to this address).`,
      recommendation:
        "Scan an address with recent USDC Approvals for denser subject-scoped findings, or deepen subgraph startBlock.",
      evidenceIds: context.slice(0, 5).map((e) => e.id),
    });
  }

  const profile = evidence.find((e) => e.id === "addr-profile");
  if (profile) {
    findings.push({
      id: randomUUID(),
      title: profile.title,
      severity: "info",
      confidence: 0.9,
      summary: profile.detail,
      recommendation: profile.url
        ? `Inspect on explorer: ${profile.url}`
        : "Cross-check bytecode and nonce before interacting.",
      evidenceIds: [profile.id],
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: randomUUID(),
      title: "No approval patterns in current evidence set",
      severity: "info",
      confidence: 0.5,
      summary:
        "Detectors found no approval/revoke/Permit2 signals. Evidence list may still include Graph/RPC notes.",
      recommendation:
        "Try a busier USDC-approving address, or expand subgraph startBlock / token set.",
      evidenceIds: evidence.slice(0, 3).map((e) => e.id),
    });
  }

  return findings;
}

export function summarizeFindings(findings: Finding[]): string {
  const high = findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  ).length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  if (high > 0) {
    return `${high} high/critical · ${medium} medium finding(s). Review approvals before interacting.`;
  }
  if (medium > 0) {
    return `${medium} medium finding(s), no high-severity hits. Review spender surface and Permit2.`;
  }
  return `${findings.length} informational finding(s). Graph/RPC evidence attached for review.`;
}
