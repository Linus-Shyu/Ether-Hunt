import type { EvidenceItem } from "@ether-hunt/shared";

const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

/**
 * Public-RPC Approval logs as development evidence.
 * This is NOT The Graph — prize demos must use GRAPH_SUBGRAPH_URL live queries.
 */
export async function fetchRpcApprovalEvidence(
  address: string,
): Promise<{ evidence: EvidenceItem[]; note: string }> {
  const rpc =
    process.env.ETH_RPC_URL?.trim() || "https://rpc.flashbots.net";
  const owner = address.toLowerCase();
  const paddedOwner = "0x" + owner.slice(2).padStart(64, "0");
  const lookback = Number(process.env.ETH_LOG_LOOKBACK ?? 45);

  try {
    const latestHex = (await rpcCall(rpc, "eth_blockNumber", [])) as string;
    const latest = Number.parseInt(latestHex, 16);
    const fromBlock = "0x" + Math.max(latest - lookback, 0).toString(16);

    const logs = (await rpcCall(rpc, "eth_getLogs", [
      {
        fromBlock,
        toBlock: "latest",
        topics: [APPROVAL_TOPIC, paddedOwner],
      },
    ])) as Array<{
      address: string;
      data: string;
      topics: string[];
      transactionHash: string;
      blockNumber: string;
    }>;

    const evidence: EvidenceItem[] = logs.slice(0, 12).map((log, index) => {
      const spenderTopic = log.topics[2] ?? "";
      const spender = "0x" + spenderTopic.slice(26);
      const value = BigInt(log.data || "0x0");
      const unlimited = value > 10n ** 50n;
      return {
        id: `${log.transactionHash}-${index}`,
        kind: "approval",
        title: unlimited ? "Unlimited ERC-20 approval (RPC)" : "ERC-20 approval (RPC)",
        detail: `token=${log.address} spender=${spender} value=${value.toString()}`,
        ref: log.transactionHash,
        url: `https://etherscan.io/tx/${log.transactionHash}`,
      };
    });

    if (evidence.length === 0) {
      evidence.push({
        id: "rpc-empty",
        kind: "other",
        title: "No recent Approval logs",
        detail: `No Approval events for owner in last ~${lookback} blocks via ${rpc}.`,
      });
    }

    return {
      evidence,
      note: `RPC eth_getLogs via ${rpc} (not Graph — configure GRAPH_SUBGRAPH_URL for prize).`,
    };
  } catch (error) {
    return {
      evidence: [
        {
          id: "rpc-error",
          kind: "other",
          title: "RPC evidence failed",
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
      note: "RPC fallback failed",
    };
  }
}

async function rpcCall(rpc: string, method: string, params: unknown[]) {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: unknown; error?: { message: string } };
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}
