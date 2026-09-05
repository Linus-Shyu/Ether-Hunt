import type { EvidenceItem } from "@ether-hunt/shared";
import { fetchJson } from "./http.js";

function rpcCandidates(): string[] {
  const primary = process.env.ETH_RPC_URL?.trim();
  const list = [
    primary,
    "https://rpc.flashbots.net",
    "https://ethereum.publicnode.com",
    "https://1rpc.io/eth",
    "https://cloudflare-eth.com",
  ].filter(Boolean) as string[];
  return [...new Set(list)];
}

async function rpcCall(
  method: string,
  params: unknown[],
): Promise<{ result: unknown; rpc: string }> {
  let lastError = "all RPCs failed";
  for (const rpc of rpcCandidates()) {
    const response = await fetchJson(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      timeoutMs: 4_000,
      retries: 0,
    });
    if (!response.ok || response.error) {
      lastError = response.error ?? `HTTP ${response.status} @ ${rpc}`;
      continue;
    }
    const payload = response.json as {
      result?: unknown;
      error?: { message: string };
    };
    if (payload.error) {
      lastError = `${payload.error.message} @ ${rpc}`;
      continue;
    }
    return { result: payload.result, rpc };
  }
  throw new Error(lastError);
}

/**
 * Address profile + optional recent Approval logs (supplements Graph).
 */
export async function fetchAddressProfile(
  address: string,
): Promise<EvidenceItem[]> {
  const owner = address.toLowerCase();
  const items: EvidenceItem[] = [];

  try {
    const [codeRes, txRes] = await Promise.all([
      rpcCall("eth_getCode", [owner, "latest"]),
      rpcCall("eth_getTransactionCount", [owner, "latest"]),
    ]);
    const code = codeRes.result as string;
    const txCountHex = txRes.result as string;
    const isContract = Boolean(code && code !== "0x" && code.length > 2);
    const nonce = Number.parseInt(txCountHex, 16);
    items.push({
      id: "addr-profile",
      kind: "code",
      title: isContract ? "Contract account" : "EOA (externally owned account)",
      detail: isContract
        ? `Bytecode size≈${Math.max(0, (code.length - 2) / 2)} bytes · nonce=${nonce} · via ${codeRes.rpc}`
        : `No bytecode · nonce=${Number.isFinite(nonce) ? nonce : txCountHex} · via ${codeRes.rpc}`,
      url: `https://etherscan.io/address/${owner}`,
      ref: owner,
    });
  } catch (error) {
    items.push({
      id: "addr-profile-error",
      kind: "other",
      title: "Address profile unavailable",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return items;
}

const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

export async function fetchRpcApprovalEvidence(
  address: string,
): Promise<{ evidence: EvidenceItem[]; note: string }> {
  const owner = address.toLowerCase();
  const paddedOwner = "0x" + owner.slice(2).padStart(64, "0");
  const lookback = Number(process.env.ETH_LOG_LOOKBACK ?? 800);

  try {
    const latestRes = await rpcCall("eth_blockNumber", []);
    const latestHex = latestRes.result as string;
    const latest = Number.parseInt(latestHex, 16);
    const fromBlock = "0x" + Math.max(latest - lookback, 0).toString(16);

    const logsRes = await rpcCall("eth_getLogs", [
      {
        fromBlock,
        toBlock: "latest",
        topics: [APPROVAL_TOPIC, paddedOwner],
      },
    ]);
    const logs = logsRes.result as Array<{
      address: string;
      data: string;
      topics: string[];
      transactionHash: string;
      blockNumber: string;
    }>;

    const evidence: EvidenceItem[] = (logs ?? []).slice(0, 15).map((log, index) => {
      const spenderTopic = log.topics[2] ?? "";
      const spender = "0x" + spenderTopic.slice(26);
      const value = BigInt(log.data || "0x0");
      const unlimited = value > 10n ** 50n;
      return {
        id: `rpc-${log.transactionHash}-${index}`,
        kind: "approval",
        title: unlimited
          ? "Unlimited ERC-20 approval (RPC)"
          : "ERC-20 approval (RPC)",
        detail: `token=${log.address} spender=${spender} value=${value.toString()} block=${Number.parseInt(log.blockNumber, 16)}`,
        ref: log.transactionHash,
        url: `https://etherscan.io/tx/${log.transactionHash}`,
      };
    });

    if (evidence.length === 0) {
      evidence.push({
        id: "rpc-empty",
        kind: "other",
        title: "No recent Approval logs (RPC)",
        detail: `No Approval events for owner in last ~${lookback} blocks via ${logsRes.rpc}.`,
      });
    }

    return {
      evidence,
      note: `RPC lookback≈${lookback} via ${logsRes.rpc} (supplement — Graph remains prize source).`,
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
