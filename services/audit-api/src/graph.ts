import type { EvidenceItem } from "@ether-hunt/shared";

export const APPROVALS_QUERY = `
query Approvals($id: ID!) {
  account(id: $id) {
    id
    approvals(first: 10, orderBy: value, orderDirection: desc, where: { value_gt: "0" }) {
      id
      value
      token { id symbol name }
      spender { id }
    }
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
 * Fetches live evidence from a Graph gateway URL.
 * Set GRAPH_SUBGRAPH_URL to a Studio/gateway subgraph HTTP endpoint.
 * Optional GRAPH_API_KEY as Bearer token when the gateway requires it.
 */
export async function fetchGraphEvidence(
  address: string,
): Promise<GraphFetchResult> {
  const endpoint = process.env.GRAPH_SUBGRAPH_URL?.trim();
  const apiKey = process.env.GRAPH_API_KEY?.trim();

  if (!endpoint) {
    return {
      live: false,
      note: "GRAPH_SUBGRAPH_URL not set — configure Subgraph Studio for prize-eligible live data.",
      evidence: [
        {
          id: "graph-config-missing",
          kind: "other",
          title: "Graph not configured",
          detail:
            "No live subgraph endpoint. Set GRAPH_SUBGRAPH_URL (and GRAPH_API_KEY if required) to qualify for The Graph prize.",
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

  const id = address.toLowerCase();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: APPROVALS_QUERY,
        variables: { id },
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
        account?: {
          id: string;
          approvals?: Array<{
            id: string;
            value: string;
            token?: { id: string; symbol?: string; name?: string };
            spender?: { id: string };
          }>;
        } | null;
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

    const approvals = payload.data?.account?.approvals ?? [];
    const evidence: EvidenceItem[] = approvals.map((a, index) => {
      const symbol = a.token?.symbol ?? "token";
      const spender = a.spender?.id ?? "unknown";
      const unlimited =
        a.value.startsWith("0xffffffffffffffffffffffffffffffffffffffff") ||
        a.value.length >= 70;
      return {
        id: a.id || `approval-${index}`,
        kind: "approval",
        title: unlimited
          ? `Unlimited ${symbol} approval`
          : `${symbol} approval`,
        detail: `Spender ${spender} allowance=${a.value}`,
        ref: a.id,
      };
    });

    if (evidence.length === 0) {
      evidence.push({
        id: "graph-empty",
        kind: "other",
        title: "No approvals indexed for account",
        detail:
          "Live Graph query succeeded but returned zero approvals for this address (or schema mismatch).",
      });
    }

    return {
      live: true,
      endpoint,
      note: `Live Graph query OK (${evidence.length} evidence rows).`,
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
