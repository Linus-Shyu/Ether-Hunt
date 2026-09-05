import type { EvidenceItem } from "@ether-hunt/shared";
import { fetchGraphEvidence } from "./graph.js";
import { fetchRpcApprovalEvidence, fetchAddressProfile } from "./rpcEvidence.js";

export type EvidenceBundle = {
  at: number;
  graph: Awaited<ReturnType<typeof fetchGraphEvidence>>;
  evidence: EvidenceItem[];
  graphNote: string;
};

const TTL_MS = 5 * 60_000;
const cache = new Map<string, EvidenceBundle | Promise<EvidenceBundle>>();

export async function gatherEvidence(address: string): Promise<EvidenceBundle> {
  // Graph first — prize source. Do NOT Promise.all with RPC profile:
  // eth_getCode / nonce often costs 10s+ and dominates paid-scan latency.
  const graph = await fetchGraphEvidence(address);
  const graphHasSubjectApprovals = graph.evidence.some(
    (e) => e.kind === "approval" && !/network context/i.test(e.title),
  );

  if (graphHasSubjectApprovals) {
    return {
      at: Date.now(),
      graph,
      evidence: graph.evidence,
      graphNote: `${graph.note} | profile/RPC skipped — live Graph has subject approvals`,
    };
  }

  const [profile, rpc] = await Promise.all([
    fetchAddressProfile(address),
    fetchRpcApprovalEvidence(address),
  ]);
  const rpcUseful = rpc.evidence.filter((e) => e.id !== "rpc-empty");

  return {
    at: Date.now(),
    graph,
    evidence: [...graph.evidence, ...profile, ...rpcUseful],
    graphNote: `${graph.note} | ${rpc.note}`,
  };
}

/** Kick off Graph while x402 settle runs (or earlier from /scan/warm). */
export function warmEvidence(address: string): void {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit instanceof Promise) return;
  if (hit && Date.now() - hit.at < TTL_MS) return;
  const pending = gatherEvidence(address)
    .then((bundle) => {
      cache.set(key, bundle);
      return bundle;
    })
    .catch(async () => {
      cache.delete(key);
      return gatherEvidence(address);
    });
  cache.set(key, pending);
}

export async function takeEvidence(address: string): Promise<EvidenceBundle> {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit) {
    const bundle = hit instanceof Promise ? await hit : hit;
    if (Date.now() - bundle.at < TTL_MS) {
      // Keep cache for rapid re-scans / dual-rail demos.
      return bundle;
    }
    cache.delete(key);
  }
  return gatherEvidence(address);
}
