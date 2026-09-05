export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type EvidenceKind =
  | "approval"
  | "role_change"
  | "paused"
  | "upgrade"
  | "transfer"
  | "code"
  | "other";

/**
 * Aggregates the subgraph computed at index time. Present only when the
 * deployed subgraph exposes allowance state; detectors must degrade gracefully
 * without them.
 */
export interface EvidenceMetrics {
  /** Live allowance in token minor units. */
  currentValue?: string;
  /** Highest allowance ever granted on this pair. */
  peakValue?: string;
  /** How many times this owner→spender pair was re-approved. */
  approvalCount?: number;
  /** Unlimited allowances this spender still holds, across all owners. */
  spenderLiveUnlimited?: number;
  /** Distinct (token, owner) pairs that approved this spender. */
  spenderDistinctOwners?: number;
  /** Unlimited allowances the subject still has outstanding. */
  ownerLiveUnlimited?: number;
}

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  title: string;
  detail: string;
  /** Explorer / Graph deep link when available */
  url?: string;
  /** Raw Graph entity id or tx hash */
  ref?: string;
  occurredAt?: string;
  /** Optional graph edges for allowance relationship viz */
  links?: {
    token?: string;
    owner?: string;
    spender?: string;
    unlimited?: boolean;
    /** Allowance is currently zero — exposure already closed. */
    revoked?: boolean;
    tokenLabel?: string;
    role?: "owner" | "spender" | "context";
  };
  metrics?: EvidenceMetrics;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  confidence: number;
  summary: string;
  recommendation: string;
  evidenceIds: string[];
}

export interface AuditAiLayer {
  enabled: boolean;
  model?: string;
  narrative: string;
  note: string;
}

export interface AuditRequest {
  chainId: number;
  address: string;
  /** Skip payment gate in local DEV only — never for prize demos */
  bypassPayment?: boolean;
}

export interface AuditReport {
  id: string;
  createdAt: string;
  chainId: number;
  address: string;
  networkLabel: string;
  summary: string;
  findings: Finding[];
  evidence: EvidenceItem[];
  ai?: AuditAiLayer;
  sources: {
    graph: {
      live: boolean;
      endpoint?: string;
      note: string;
      /** Which subgraph schema the endpoint answered on. */
      mode?: "allowance-state" | "approval-events";
      /** The exact GraphQL this scan ran, so a reviewer can replay it. */
      query?: string;
    };
    payment: {
      required: boolean;
      settled: boolean;
      rail: "hedera-x402" | "arc-gateway" | "dev-bypass" | "none";
      note: string;
      facilitatorUrl?: string;
      facilitatorDocsUrl?: string;
      payTo?: string;
      explorerUrl?: string;
      agentExplorerUrl?: string;
    };
  };
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export {
  CASE_FILES,
  CASE_FILE_ADDRESSES,
  isCaseFileAddress,
  type CaseFilePreset,
} from "./caseFiles.js";

