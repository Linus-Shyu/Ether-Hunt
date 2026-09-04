import type { EvidenceItem } from "@ether-hunt/shared";
import { fetchJson } from "./http.js";

/** Owner-scoped approvals from our Studio subgraph. */
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

export interface GraphFetchResult {
  live: boolean;
  endpoint?: string;
  note: string;
  evidence: EvidenceItem[];
  stats: {
    asOwner: number;
    asSpender: number;
    contextUnlimited: number;
  };
}

type ApprovalRow = {
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

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const KNOWN_SPENDERS: Record<string, string> = {
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Uniswap Permit2",
  "0xc36442b4a4522e871399cd717abdd847ab11fe88":
    "Uniswap V3 NonfungiblePositionManager",
  "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f": "Circle TokenMessenger",
  "0xbd3fa81b58ba92a82136038b25adec7066af3155": "Circle TokenMessenger (alt)",
};

function labelAddress(addr: string): string {
  const lower = addr.toLowerCase();
  const known = KNOWN_SPENDERS[lower];
  return known ? `${short(addr)} (${known})` : short(addr);
}

function isUnlimited(value: string) {
  return (
    value === MAX_UINT ||
    value.startsWith("115792089") ||
    value.length >= 70
  );
}

function formatUsdcHint(value: string): string {
  try {
    const v = BigInt(value);
    if (v === 0n) return "0 (revoked)";
    if (isUnlimited(value)) return "unlimited (max uint256)";
    // USDC 6 decimals heuristic for our probe token
    if (v < 10n ** 15n) {
      const whole = Number(v) / 1e6;
      if (Number.isFinite(whole)) return `≈ ${whole.toLocaleString()} USDC units`;
    }
    return value;
  } catch {
    return value;
  }
}

function rowToEvidence(
  a: ApprovalRow,
  index: number,
  role: "owner" | "spender" | "context",
): EvidenceItem {
  const unlimited = isUnlimited(a.value);
  const revoked = a.value === "0";
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

  const when = a.timestamp
    ? new Date(Number(a.timestamp) * 1000).toISOString()
    : undefined;

  return {
    id: a.id || `${role}-${index}`,
    kind: "approval",
    title,
    detail: [
      `token=${labelAddress(a.token)} (USDC)`,
      `owner=${labelAddress(a.owner)}`,
      `spender=${labelAddress(a.spender)}`,
      `value=${formatUsdcHint(a.value)}`,
      when ? `at=${when}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ref: a.transactionHash ?? a.id,
    url: a.transactionHash
      ? `https://etherscan.io/tx/${a.transactionHash}`
      : undefined,
    occurredAt: when,
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
  const emptyStats = { asOwner: 0, asSpender: 0, contextUnlimited: 0 };

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
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const owner = address.toLowerCase();
  try {
    const response = await fetchJson(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: APPROVAL_EVENTS_QUERY,
        variables: { owner },
      }),
      timeoutMs: 25_000,
      retries: 3,
    });

    if (!response.ok) {
      return {
        live: false,
        endpoint,
        note: response.error
          ? `Graph fetch failed: ${response.error}`
          : `Graph HTTP ${response.status}`,
        evidence: [
          {
            id: "graph-http-error",
            kind: "other",
            title: "Graph request failed",
            detail: response.error
              ? response.error
              : `HTTP ${response.status} from subgraph endpoint.`,
          },
        ],
        stats: emptyStats,
      };
    }

    const payload = response.json as {
      data?: {
        asOwner?: ApprovalRow[];
        asSpender?: ApprovalRow[];
        recentUnlimited?: ApprovalRow[];
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      return {
        live: false,
        endpoint,
        note: payload.errors.map((e) => e.message).join("; "),
        evidence: [
          {
            id: "graph-gql-error",
            kind: "other",
            title: "Graph GraphQL error",
            detail: payload.errors.map((e) => e.message).join("; "),
          },
        ],
        stats: emptyStats,
      };
    }

    const asOwner = payload.data?.asOwner ?? [];
    const asSpender = payload.data?.asSpender ?? [];
    const recentUnlimited = payload.data?.recentUnlimited ?? [];

    const evidence: EvidenceItem[] = [
      ...asOwner.map((a, i) => rowToEvidence(a, i, "owner")),
      ...asSpender.map((a, i) => rowToEvidence(a, i, "spender")),
    ];

    // Network context (labeled) when subject has little owner history in indexed window
    if (asOwner.length < 3) {
      for (const [i, row] of recentUnlimited.entries()) {
        if (row.owner.toLowerCase() === owner) continue;
        evidence.push(rowToEvidence(row, i, "context"));
      }
    }

    if (asOwner.length === 0 && asSpender.length === 0) {
      evidence.unshift({
        id: "graph-subject-empty",
        kind: "other",
        title: "No subject-scoped ApprovalEvents in indexed window",
        detail:
          "This subgraph currently indexes USDC Approvals from a recent mainnet start block. Try an address that recently approved USDC, or wait for deeper sync / lower startBlock.",
      });
    }

    const stats = {
      asOwner: asOwner.length,
      asSpender: asSpender.length,
      contextUnlimited: recentUnlimited.length,
    };

    return {
      live: true,
      endpoint,
      note: `Live Graph OK — owner=${stats.asOwner}, spender=${stats.asSpender}, contextUnlimited≈${stats.contextUnlimited}.`,
      evidence,
      stats,
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
