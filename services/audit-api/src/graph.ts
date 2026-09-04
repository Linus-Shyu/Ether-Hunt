import type { EvidenceItem } from "@ether-hunt/shared";

/** Schema for our Studio subgraph (`ApprovalEvent` entities). */
export const APPROVAL_EVENTS_QUERY = `
query ApprovalEvents($owner: Bytes!) {
  approvalEvents(first: 15, orderBy: value, orderDirection: desc, where: { owner: $owner }) {
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
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: APPROVAL_EVENTS_QUERY,
        variables: { owner },
      }),
    });

    if (!response.ok) {
      return {
        live: false,
        endpoint,
        note: `Graph HTTP ${response.status}`,
        evidence: [
          {
            id: "graph-http-error",
            kind: "other",
            title: "Graph request failed",
            detail: `HTTP ${response.status} from subgraph endpoint.`,
          },
        ],
      };
    }

    const payload = (await response.json()) as {
      data?: {
        approvalEvents?: Array<{
          id: string;
          token: string;
          owner: string;
          spender: string;
          value: string;
          timestamp?: string;
          transactionHash?: string;
        }>;
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
      };
    }

    const rows = payload.data?.approvalEvents ?? [];
    const evidence: EvidenceItem[] = rows.map((a, index) => {
      const unlimited = a.value.length >= 70 || a.value.startsWith("115792089");
      return {
        id: a.id || `approval-${index}`,
        kind: "approval",
        title: unlimited ? "Unlimited approval (Graph)" : "Approval (Graph)",
        detail: `token=${a.token} spender=${a.spender} value=${a.value}`,
        ref: a.transactionHash ?? a.id,
        occurredAt: a.timestamp
          ? new Date(Number(a.timestamp) * 1000).toISOString()
          : undefined,
      };
    });

    if (evidence.length === 0) {
      evidence.push({
        id: "graph-empty",
        kind: "other",
        title: "No ApprovalEvent rows",
        detail: "Live Graph query succeeded but returned zero matching approvals.",
      });
    }

    return {
      live: true,
      endpoint,
      note: `Live Graph query OK (${evidence.length} rows).`,
      evidence,
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
    };
  }
}
