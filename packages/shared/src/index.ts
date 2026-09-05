export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type EvidenceKind =
  | "approval"
  | "role_change"
  | "paused"
  | "upgrade"
  | "transfer"
  | "code"
  | "other";

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
    tokenLabel?: string;
    role?: "owner" | "spender" | "context";
  };
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
    };
    payment: {
      required: boolean;
      settled: boolean;
      rail: "hedera-x402" | "arc-gateway" | "dev-bypass" | "none";
      note: string;
    };
  };
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
