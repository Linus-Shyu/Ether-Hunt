import type { EvidenceItem } from "@ether-hunt/shared";
import { fetchJson } from "./http.js";
import { describeAddress } from "./spenders.js";

/**
 * Allowance state as folded by the subgraph mapping (schema >= v0.0.2).
 *
 * This is the query we want: the index already knows which allowances are still
 * live, how concentrated each spender is, and how often a pair was re-approved,
 * so the API never replays event history to work that out.
 */
export const ALLOWANCE_STATE_QUERY = `
query AllowanceState($account: ID!) {
  account(id: $account) {
    id
    approvalCount
    unlimitedGrantCount
    liveUnlimitedCount
    revokeCount
    distinctSpenderPairs
    firstSeen
    lastSeen
    allowances(first: 25, orderBy: lastSeen, orderDirection: desc) {
      id
      token
      currentValue
      peakValue
      unlimited
      revoked
      approvalCount
      revokeCount
      firstSeen
      lastSeen
      lastTransactionHash
      spender {
        id
        liveUnlimitedCount
        unlimitedReceivedCount
        distinctOwnerPairs
      }
    }
  }
  spender(id: $account) {
    id
    approvalCount
    unlimitedReceivedCount
    liveUnlimitedCount
    distinctOwnerPairs
    firstSeen
    lastSeen
    allowancesReceived(first: 10, orderBy: lastSeen, orderDirection: desc) {
      id
      token
      currentValue
      peakValue
      unlimited
      revoked
      lastSeen
      lastTransactionHash
      owner { id }
    }
  }
  concentratedSpenders: spenders(
    first: 8
    orderBy: liveUnlimitedCount
    orderDirection: desc
    where: { liveUnlimitedCount_gt: 0 }
  ) {
    id
    liveUnlimitedCount
    unlimitedReceivedCount
    distinctOwnerPairs
    lastSeen
  }
}
`;

/** Raw-log query kept for subgraph deployments that predate allowance state. */
export const APPROVAL_EVENTS_QUERY = `
query ApprovalEvents($owner: Bytes!) {
  asOwner: approvalEvents(
    first: 25
    orderBy: timestamp
    orderDirection: desc
    where: { owner: $owner }
  ) {
    id
    token
    owner
    spender
    value
    timestamp
    transactionHash
  }
  asSpender: approvalEvents(
    first: 10
    orderBy: timestamp
    orderDirection: desc
    where: { spender: $owner }
  ) {
    id
    token
    owner
    spender
    value
    timestamp
    transactionHash
  }
  recentUnlimited: approvalEvents(
    first: 8
    orderBy: timestamp
    orderDirection: desc
    where: { value_gt: "100000000000000000000000000000000000000" }
  ) {
    id
    token
    owner
    spender
    value
    timestamp
    transactionHash
  }
}
`;

export type GraphMode = "allowance-state" | "approval-events";

export interface GraphFetchResult {
  live: boolean;
  endpoint?: string;
  note: string;
  /** The exact GraphQL this call ran — surfaced in the UI for replay. */
  query?: string;
  evidence: EvidenceItem[];
  stats: {
    mode: GraphMode;
    asOwner: number;
    asSpender: number;
    contextUnlimited: number;
    /** Unlimited allowances the subject still has outstanding. */
    liveUnlimited: number;
  };
}

type SpenderRow = {
  id: string;
  liveUnlimitedCount: number;
  unlimitedReceivedCount: number;
  distinctOwnerPairs: number;
  lastSeen?: string;
};

type AllowanceRow = {
  id: string;
  token: string;
  currentValue: string;
  peakValue: string;
  unlimited: boolean;
  revoked: boolean;
  approvalCount?: number;
  revokeCount?: number;
  firstSeen?: string;
  lastSeen: string;
  lastTransactionHash: string;
  spender?: SpenderRow;
  owner?: { id: string };
};

type AccountRow = {
  id: string;
  approvalCount: number;
  unlimitedGrantCount: number;
  liveUnlimitedCount: number;
  revokeCount: number;
  distinctSpenderPairs: number;
  firstSeen: string;
  lastSeen: string;
  allowances: AllowanceRow[];
};

type SpenderDetailRow = SpenderRow & {
  approvalCount: number;
  firstSeen: string;
  allowancesReceived: AllowanceRow[];
};

type ApprovalEventRow = {
  id: string;
  token: string;
  owner: string;
  spender: string;
  value: string;
  timestamp?: string;
  transactionHash?: string;
};

const MAX_UINT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

function isUnlimitedValue(value: string) {
  return (
    value === MAX_UINT || value.startsWith("115792089") || value.length >= 70
  );
}

function formatUsdc(value: string): string {
  try {
    const v = BigInt(value);
    if (v === 0n) return "0 (revoked)";
    if (isUnlimitedValue(value)) return "unlimited (max uint256)";
    if (v < 10n ** 15n) {
      const whole = Number(v) / 1e6;
      if (Number.isFinite(whole)) return `≈ ${whole.toLocaleString()} USDC`;
    }
    return value;
  } catch {
    return value;
  }
}

function isoFrom(seconds: string | undefined): string | undefined {
  if (!seconds) return undefined;
  const n = Number(seconds);
  return Number.isFinite(n) ? new Date(n * 1000).toISOString() : undefined;
}

/* ------------------------------ state mode ------------------------------ */

function allowanceToEvidence(
  row: AllowanceRow,
  subject: string,
  role: "owner" | "spender",
  ownerLiveUnlimited: number,
): EvidenceItem {
  const owner = role === "owner" ? subject : (row.owner?.id ?? subject);
  const spender = role === "owner" ? (row.spender?.id ?? "") : subject;
  const live = row.unlimited && !row.revoked;

  let title: string;
  if (role === "spender") {
    title = live
      ? "Holds a live unlimited allowance from another owner"
      : "Named as spender on an allowance";
  } else if (live) {
    title = "Live unlimited allowance — still spendable";
  } else if (row.revoked) {
    title = "Allowance revoked — exposure closed";
  } else {
    title = "Finite allowance outstanding";
  }

  const when = isoFrom(row.lastSeen);

  return {
    id: row.id,
    kind: "approval",
    title,
    detail: [
      `token=${describeAddress(row.token)} (USDC)`,
      `owner=${describeAddress(owner)}`,
      spender ? `spender=${describeAddress(spender)}` : null,
      `live=${formatUsdc(row.currentValue)}`,
      row.peakValue !== row.currentValue
        ? `peak=${formatUsdc(row.peakValue)}`
        : null,
      row.approvalCount ? `reapproved=${row.approvalCount}×` : null,
      when ? `at=${when}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ref: row.lastTransactionHash ?? row.id,
    url: row.lastTransactionHash
      ? `https://etherscan.io/tx/${row.lastTransactionHash}`
      : undefined,
    occurredAt: when,
    links: {
      token: row.token.toLowerCase(),
      owner: owner.toLowerCase(),
      spender: spender ? spender.toLowerCase() : undefined,
      unlimited: row.unlimited,
      revoked: row.revoked,
      tokenLabel: "USDC",
      role,
    },
    metrics: {
      currentValue: row.currentValue,
      peakValue: row.peakValue,
      approvalCount: row.approvalCount,
      spenderLiveUnlimited: row.spender?.liveUnlimitedCount,
      spenderDistinctOwners: row.spender?.distinctOwnerPairs,
      ownerLiveUnlimited,
    },
  };
}

function concentratedSpenderToEvidence(row: SpenderRow): EvidenceItem {
  const when = isoFrom(row.lastSeen);
  return {
    id: `spender-${row.id}`,
    kind: "approval",
    title: "Concentrated spender (network context)",
    detail: [
      `spender=${describeAddress(row.id)}`,
      `liveUnlimited=${row.liveUnlimitedCount}`,
      `distinctOwners=${row.distinctOwnerPairs}`,
      when ? `lastSeen=${when}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ref: row.id,
    url: `https://etherscan.io/address/${row.id}`,
    occurredAt: when,
    links: {
      spender: row.id.toLowerCase(),
      unlimited: row.liveUnlimitedCount > 0,
      tokenLabel: "USDC",
      role: "context",
    },
    metrics: {
      spenderLiveUnlimited: row.liveUnlimitedCount,
      spenderDistinctOwners: row.distinctOwnerPairs,
    },
  };
}

function buildStateEvidence(
  subject: string,
  account: AccountRow | null,
  spender: SpenderDetailRow | null,
  concentrated: SpenderRow[],
): { evidence: EvidenceItem[]; stats: GraphFetchResult["stats"] } {
  const ownerLive = account?.liveUnlimitedCount ?? 0;
  const ownerRows = account?.allowances ?? [];
  const spenderRows = spender?.allowancesReceived ?? [];

  const evidence: EvidenceItem[] = [
    ...ownerRows.map((row) =>
      allowanceToEvidence(row, subject, "owner", ownerLive),
    ),
    ...spenderRows.map((row) =>
      allowanceToEvidence(row, subject, "spender", ownerLive),
    ),
  ];

  if (account) {
    evidence.unshift({
      id: "account-state",
      kind: "other",
      title: "Indexed allowance posture",
      detail: [
        `approvals=${account.approvalCount}`,
        `unlimitedEverGranted=${account.unlimitedGrantCount}`,
        `liveUnlimited=${account.liveUnlimitedCount}`,
        `revokes=${account.revokeCount}`,
        `distinctSpenderPairs=${account.distinctSpenderPairs}`,
        `firstSeen=${isoFrom(account.firstSeen) ?? "?"}`,
      ].join(" · "),
      occurredAt: isoFrom(account.lastSeen),
      metrics: { ownerLiveUnlimited: account.liveUnlimitedCount },
    });
  }

  // Only borrow network context when the subject itself is thin.
  if (ownerRows.length < 3) {
    for (const row of concentrated) {
      if (row.id.toLowerCase() === subject) continue;
      evidence.push(concentratedSpenderToEvidence(row));
    }
  }

  if (!account && !spender) {
    evidence.unshift({
      id: "graph-subject-empty",
      kind: "other",
      title: "No indexed allowance state for this subject",
      detail:
        "The subgraph indexes USDC Approvals from a mainnet start block; this address has none in that window. Try an address that approved USDC recently.",
    });
  }

  return {
    evidence,
    stats: {
      mode: "allowance-state",
      asOwner: ownerRows.length,
      asSpender: spenderRows.length,
      contextUnlimited: concentrated.length,
      liveUnlimited: ownerLive,
    },
  };
}

/* ------------------------------ event mode ------------------------------ */

function eventToEvidence(
  row: ApprovalEventRow,
  index: number,
  role: "owner" | "spender" | "context",
): EvidenceItem {
  const unlimited = isUnlimitedValue(row.value);
  const revoked = row.value === "0";

  let title: string;
  if (role === "context") {
    title = unlimited
      ? "Recent unlimited USDC approval (network context)"
      : "Recent large USDC approval (network context)";
  } else if (role === "spender") {
    title = unlimited
      ? "Address is spender of unlimited approval"
      : "Address is spender of an approval";
  } else if (revoked) {
    title = "Approval revoked (value=0)";
  } else if (unlimited) {
    title = "Unlimited USDC approval (Graph)";
  } else {
    title = "USDC approval (Graph)";
  }

  const when = isoFrom(row.timestamp);

  return {
    id: row.id || `${role}-${index}`,
    kind: "approval",
    title,
    detail: [
      `token=${describeAddress(row.token)} (USDC)`,
      `owner=${describeAddress(row.owner)}`,
      `spender=${describeAddress(row.spender)}`,
      `value=${formatUsdc(row.value)}`,
      when ? `at=${when}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ref: row.transactionHash ?? row.id,
    url: row.transactionHash
      ? `https://etherscan.io/tx/${row.transactionHash}`
      : undefined,
    occurredAt: when,
    links: {
      token: row.token.toLowerCase(),
      owner: row.owner.toLowerCase(),
      spender: row.spender.toLowerCase(),
      unlimited,
      revoked,
      tokenLabel: "USDC",
      role,
    },
    metrics: { currentValue: row.value },
  };
}

function buildEventEvidence(
  subject: string,
  asOwner: ApprovalEventRow[],
  asSpender: ApprovalEventRow[],
  recentUnlimited: ApprovalEventRow[],
): { evidence: EvidenceItem[]; stats: GraphFetchResult["stats"] } {
  const evidence: EvidenceItem[] = [
    ...asOwner.map((row, i) => eventToEvidence(row, i, "owner")),
    ...asSpender.map((row, i) => eventToEvidence(row, i, "spender")),
  ];

  if (asOwner.length < 3) {
    for (const [i, row] of recentUnlimited.entries()) {
      if (row.owner.toLowerCase() === subject) continue;
      evidence.push(eventToEvidence(row, i, "context"));
    }
  }

  if (asOwner.length === 0 && asSpender.length === 0) {
    evidence.unshift({
      id: "graph-subject-empty",
      kind: "other",
      title: "No subject-scoped ApprovalEvents in indexed window",
      detail:
        "This subgraph indexes USDC Approvals from a recent mainnet start block. Try an address that recently approved USDC, or wait for deeper sync.",
    });
  }

  return {
    evidence,
    stats: {
      mode: "approval-events",
      asOwner: asOwner.length,
      asSpender: asSpender.length,
      contextUnlimited: recentUnlimited.length,
      liveUnlimited: asOwner.filter(
        (r) => isUnlimitedValue(r.value) && r.value !== "0",
      ).length,
    },
  };
}

/* --------------------------- capability probing --------------------------- */

type GqlResponse = {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
};

/**
 * Which schema the configured endpoint speaks. A fresh `graph deploy` needs a
 * full resync, so during that window the old deployment is still serving —
 * cached with a TTL so the richer schema is picked up without a restart.
 */
let cachedMode: { mode: GraphMode; at: number } | null = null;
const MODE_TTL_MS = 10 * 60_000;

function schemaRejected(errors: Array<{ message: string }> | undefined) {
  if (!errors?.length) return false;
  return errors.some((e) =>
    /has no field|Unknown (field|argument|type)|Type `?\w+`? has no/i.test(
      e.message,
    ),
  );
}

async function runQuery(
  endpoint: string,
  headers: Record<string, string>,
  query: string,
  variables: Record<string, string>,
) {
  const response = await fetchJson(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    timeoutMs: 12_000,
    retries: 1,
  });
  return {
    ok: response.ok,
    status: response.status,
    error: response.error,
    payload: (response.json ?? {}) as GqlResponse,
  };
}

/**
 * Fetches live evidence from a Graph gateway / Studio URL.
 * Set GRAPH_SUBGRAPH_URL (+ optional GRAPH_API_KEY).
 */
export async function fetchGraphEvidence(
  address: string,
): Promise<GraphFetchResult> {
  const endpoint = process.env.GRAPH_SUBGRAPH_URL?.trim();
  const apiKey = process.env.GRAPH_API_KEY?.trim();
  const emptyStats: GraphFetchResult["stats"] = {
    mode: "approval-events",
    asOwner: 0,
    asSpender: 0,
    contextUnlimited: 0,
    liveUnlimited: 0,
  };

  if (!endpoint) {
    return {
      live: false,
      note: "GRAPH_SUBGRAPH_URL not set — deploy subgraphs/token-approvals to Studio for prize-eligible live data.",
      evidence: [
        {
          id: "graph-config-missing",
          kind: "other",
          title: "Graph not configured",
          detail:
            "No live subgraph endpoint. See subgraphs/token-approvals/README.md.",
        },
      ],
      stats: emptyStats,
    };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const subject = address.toLowerCase();
  const modeFresh =
    cachedMode !== null && Date.now() - cachedMode.at < MODE_TTL_MS;
  const tryState = !modeFresh || cachedMode?.mode === "allowance-state";

  try {
    if (tryState) {
      const state = await runQuery(endpoint, headers, ALLOWANCE_STATE_QUERY, {
        account: subject,
      });

      if (state.ok && !state.payload.errors?.length) {
        cachedMode = { mode: "allowance-state", at: Date.now() };
        const data = state.payload.data as
          | {
              account?: AccountRow | null;
              spender?: SpenderDetailRow | null;
              concentratedSpenders?: SpenderRow[];
            }
          | undefined;
        const built = buildStateEvidence(
          subject,
          data?.account ?? null,
          data?.spender ?? null,
          data?.concentratedSpenders ?? [],
        );
        return {
          live: true,
          endpoint,
          note: `Live Graph OK (allowance-state) — allowances=${built.stats.asOwner}, asSpender=${built.stats.asSpender}, liveUnlimited=${built.stats.liveUnlimited}.`,
          query: ALLOWANCE_STATE_QUERY.trim(),
          ...built,
        };
      }

      if (state.ok && schemaRejected(state.payload.errors)) {
        // Deployed subgraph predates allowance state — use raw logs below.
        cachedMode = { mode: "approval-events", at: Date.now() };
      } else if (!state.ok) {
        return {
          live: false,
          endpoint,
          note: state.error
            ? `Graph fetch failed: ${state.error}`
            : `Graph HTTP ${state.status}`,
          evidence: [
            {
              id: "graph-http-error",
              kind: "other",
              title: "Graph request failed",
              detail:
                state.error ?? `HTTP ${state.status} from subgraph endpoint.`,
            },
          ],
          stats: emptyStats,
        };
      } else {
        const message =
          state.payload.errors?.map((e) => e.message).join("; ") ??
          "Unknown GraphQL error";
        return {
          live: false,
          endpoint,
          note: message,
          evidence: [
            {
              id: "graph-gql-error",
              kind: "other",
              title: "Graph GraphQL error",
              detail: message,
            },
          ],
          stats: emptyStats,
        };
      }
    }

    const events = await runQuery(endpoint, headers, APPROVAL_EVENTS_QUERY, {
      owner: subject,
    });

    if (!events.ok) {
      return {
        live: false,
        endpoint,
        note: events.error
          ? `Graph fetch failed: ${events.error}`
          : `Graph HTTP ${events.status}`,
        evidence: [
          {
            id: "graph-http-error",
            kind: "other",
            title: "Graph request failed",
            detail:
              events.error ?? `HTTP ${events.status} from subgraph endpoint.`,
          },
        ],
        stats: emptyStats,
      };
    }

    if (events.payload.errors?.length) {
      const message = events.payload.errors.map((e) => e.message).join("; ");
      return {
        live: false,
        endpoint,
        note: message,
        evidence: [
          {
            id: "graph-gql-error",
            kind: "other",
            title: "Graph GraphQL error",
            detail: message,
          },
        ],
        stats: emptyStats,
      };
    }

    const data = events.payload.data as
      | {
          asOwner?: ApprovalEventRow[];
          asSpender?: ApprovalEventRow[];
          recentUnlimited?: ApprovalEventRow[];
        }
      | undefined;

    const built = buildEventEvidence(
      subject,
      data?.asOwner ?? [],
      data?.asSpender ?? [],
      data?.recentUnlimited ?? [],
    );

    return {
      live: true,
      endpoint,
      note: `Live Graph OK (approval-events — deploy v0.0.2 for allowance state) — owner=${built.stats.asOwner}, spender=${built.stats.asSpender}, context≈${built.stats.contextUnlimited}.`,
      query: APPROVAL_EVENTS_QUERY.trim(),
      ...built,
    };
  } catch (error) {
    return {
      live: false,
      endpoint,
      note: error instanceof Error ? error.message : "Graph fetch failed",
      evidence: [
        {
          id: "graph-exception",
          kind: "other",
          title: "Graph fetch exception",
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
      stats: emptyStats,
    };
  }
}
