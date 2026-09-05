import type { EvidenceItem, Finding, Severity } from "@ether-hunt/shared";
import {
  describeAddress,
  isKnownIntegration,
  isPermit2,
  labelFor,
  shortAddress,
} from "./spenders.js";

/** A spender holding this many live unlimited allowances is a blast radius. */
const CONCENTRATION_LIVE_UNLIMITED = 5;
/** Cap per-allowance findings so a busy wallet stays readable. */
const MAX_ITEMISED = 6;

function isApprovalEdge(item: EvidenceItem): boolean {
  return item.kind === "approval" && item.links !== undefined;
}

function isSubjectRole(item: EvidenceItem): boolean {
  return item.links?.role === "owner" || item.links?.role === "spender";
}

/** Unlimited and not yet revoked — the allowance is still spendable today. */
function isLiveUnlimited(item: EvidenceItem): boolean {
  return item.links?.unlimited === true && item.links.revoked !== true;
}

function findingId(prefix: string, evidenceId: string): string {
  return `${prefix}-${evidenceId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24)}`;
}

function concentration(item: EvidenceItem): number {
  return item.metrics?.spenderLiveUnlimited ?? 0;
}

/** One row per (token, spender), keeping the most recent. */
function dedupeByPair(items: EvidenceItem[]): EvidenceItem[] {
  const newest = new Map<string, EvidenceItem>();
  for (const item of items) {
    const key = `${item.links?.token ?? ""}-${item.links?.spender ?? item.id}`;
    const current = newest.get(key);
    if (!current) {
      newest.set(key, item);
      continue;
    }
    if ((item.occurredAt ?? "") > (current.occurredAt ?? "")) {
      newest.set(key, item);
    }
  }
  return [...newest.values()];
}

/**
 * Deterministic analysis over structured Graph evidence.
 *
 * Every detector reads `links` / `metrics` rather than the formatted `detail`
 * string, so display copy and detection logic can change independently.
 */
export function analyzeEvidence(evidence: EvidenceItem[]): Finding[] {
  const findings: Finding[] = [];
  const edges = evidence.filter(isApprovalEdge);
  const subjectEdges = edges.filter(isSubjectRole);
  const context = edges.filter((e) => e.links?.role === "context");

  const ownerEdges = subjectEdges.filter((e) => e.links?.role === "owner");
  const spenderEdges = subjectEdges.filter((e) => e.links?.role === "spender");

  // In allowance-state mode each row is already one pair. In the raw-log
  // fallback a re-approved pair shows up once per event, so collapse to the
  // newest row per pair before itemising.
  const liveUnlimited = dedupeByPair(ownerEdges.filter(isLiveUnlimited)).sort(
    (a, b) => concentration(b) - concentration(a),
  );
  const revokedEdges = ownerEdges.filter((e) => e.links?.revoked === true);
  const finiteEdges = ownerEdges.filter(
    (e) => !isLiveUnlimited(e) && e.links?.revoked !== true,
  );

  for (const item of liveUnlimited.slice(0, MAX_ITEMISED)) {
    const spender = item.links?.spender;
    const known = isKnownIntegration(spender);
    const spread = concentration(item);
    const owners = item.metrics?.spenderDistinctOwners ?? 0;

    // A named router holding an infinite allowance is expected behaviour; an
    // unlabelled address holding one is the case worth escalating.
    const severity: Severity = known ? "medium" : "high";
    const confidence = known ? 0.74 : spread >= CONCENTRATION_LIVE_UNLIMITED ? 0.92 : 0.86;

    findings.push({
      id: findingId("live-unlimited", item.id),
      // Name the spender in the title — a wallet with a dozen infinite
      // approvals otherwise gets a dozen identical headlines.
      title: known
        ? `Unlimited allowance to ${labelFor(spender ?? "") ?? "a known contract"}`
        : spender
          ? `Unlimited allowance to unlabelled ${shortAddress(spender)}`
          : "Unlimited allowance to an unlabelled spender",
      severity,
      confidence,
      summary: [
        spender
          ? `${describeAddress(spender)} can move this token without a new signature.`
          : "An unlimited allowance is outstanding.",
        spread > 0
          ? `That spender currently holds ${spread} live unlimited allowance(s) across ${owners} owner pair(s) in the indexed set.`
          : null,
        item.metrics?.approvalCount && item.metrics.approvalCount > 1
          ? `The pair was re-approved ${item.metrics.approvalCount}×, so this is an active integration rather than a one-off.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      // The subject may be a wallet or a protocol contract, and "revoke now" is
      // wrong advice for a router whose approvals are operational by design.
      recommendation: known
        ? "Keep only if you still use this integration; otherwise revoke and re-approve exact amounts per trade."
        : "Revoke unless this spender is a counterparty you still rely on. If the subject is a contract, treat each standing infinite approval as a live dependency to review.",
      evidenceIds: [item.id],
    });
  }

  if (liveUnlimited.length > MAX_ITEMISED) {
    const rest = liveUnlimited.slice(MAX_ITEMISED);
    findings.push({
      id: "live-unlimited-overflow",
      title: `${rest.length} further unlimited allowances outstanding`,
      severity: "high",
      confidence: 0.8,
      summary: `Beyond the itemised findings, ${rest.length} more live unlimited allowance(s) remain on this address.`,
      recommendation: "Bulk-revoke the ones you no longer recognise.",
      evidenceIds: rest.slice(0, 8).map((e) => e.id),
    });
  }

  const concentrated = ownerEdges.filter(
    (e) => concentration(e) >= CONCENTRATION_LIVE_UNLIMITED,
  );
  if (concentrated.length > 0) {
    const worst = concentrated.reduce((a, b) =>
      concentration(b) > concentration(a) ? b : a,
    );
    findings.push({
      id: findingId("concentration", worst.id),
      title: "Approved spender is a concentrated failure point",
      severity: "medium",
      confidence: 0.81,
      summary: `${describeAddress(worst.links?.spender ?? "")} holds ${concentration(worst)} live unlimited allowance(s) from ${worst.metrics?.spenderDistinctOwners ?? 0} owner pair(s). A single compromise of that contract drains every one of them.`,
      recommendation:
        "Treat shared infinite-approval contracts as critical dependencies; cap allowances where the integration allows it.",
      evidenceIds: concentrated.slice(0, 5).map((e) => e.id),
    });
  }

  const permit2 = ownerEdges.filter((e) => isPermit2(e.links?.spender));
  if (permit2.length > 0) {
    findings.push({
      id: "permit2-spender",
      title: "Uniswap Permit2 holds allowance",
      severity: "low",
      confidence: 0.8,
      summary: `${permit2.length} allowance(s) route through Permit2, which brokers time-bounded permits instead of raw infinite approvals.`,
      recommendation:
        "Expected for Uniswap users. Confirm the Permit2 allowance is intentional and review per-dapp permits.",
      evidenceIds: permit2.slice(0, 5).map((e) => e.id),
    });
  }

  const liveAsSpender = spenderEdges.filter(isLiveUnlimited);
  if (liveAsSpender.length > 0) {
    findings.push({
      id: "subject-is-spender",
      title: "Address holds spend rights over other wallets",
      severity: "medium",
      confidence: 0.79,
      summary: `${liveAsSpender.length} owner(s) have granted this address a live unlimited allowance. Treat it as privileged operator surface, not a passive wallet.`,
      recommendation:
        "If this is a router or vault, publish an allowance policy. If it is an EOA, investigate why it can spend other wallets' tokens.",
      evidenceIds: liveAsSpender.slice(0, 5).map((e) => e.id),
    });
  }

  if (revokedEdges.length > 0 && liveUnlimited.length === 0) {
    findings.push({
      id: "revocation-hygiene",
      title: "Allowances were revoked after use",
      severity: "info",
      confidence: 0.75,
      summary: `${revokedEdges.length} allowance(s) are back to zero and no unlimited approval is currently live — good hygiene.`,
      recommendation: "Keep revoking after one-off integrations.",
      evidenceIds: revokedEdges.slice(0, 5).map((e) => e.id),
    });
  }

  if (finiteEdges.length > 0) {
    findings.push({
      id: "finite-allowances",
      title: "Finite allowances outstanding",
      severity: "info",
      confidence: 0.74,
      summary: `${finiteEdges.length} capped allowance(s) remain. Bounded exposure, but still spendable up to the cap.`,
      recommendation:
        "Spot-check large caps against expected dapp usage before interacting.",
      evidenceIds: finiteEdges.slice(0, 8).map((e) => e.id),
    });
  }

  if (context.length > 0 && ownerEdges.length < 3) {
    findings.push({
      id: "network-context",
      title: "Sparse subject history — network context attached",
      severity: "info",
      confidence: 0.6,
      summary: `This address has little indexed allowance activity, so ${context.length} high-concentration spender(s) from the live subgraph are attached as market context. They are not attributed to this address.`,
      recommendation:
        "Scan an address with recent USDC approvals for subject-scoped findings, or deepen the subgraph start block.",
      evidenceIds: context.slice(0, 5).map((e) => e.id),
    });
  }

  const profile = evidence.find((e) => e.id === "addr-profile");
  if (profile) {
    findings.push({
      id: "address-profile",
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
      id: "no-signal",
      title: "No approval risk patterns in current evidence",
      severity: "info",
      confidence: 0.5,
      summary:
        "Detectors found no live unlimited allowances, concentrated spenders, or operator rights for this subject.",
      recommendation:
        "Try an address with recent USDC approvals, or widen the subgraph token set / start block.",
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
    return `${high} high/critical · ${medium} medium finding(s). Revoke live unlimited allowances before interacting.`;
  }
  if (medium > 0) {
    return `${medium} medium finding(s), no high-severity hits. Review spender surface and Permit2.`;
  }
  return `${findings.length} informational finding(s). Graph evidence attached for review.`;
}
