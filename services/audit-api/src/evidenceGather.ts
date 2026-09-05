import type { EvidenceItem } from "@ether-hunt/shared";
import { fetchGraphEvidence } from "./graph.js";
import { fetchRpcApprovalEvidence, fetchAddressProfile } from "./rpcEvidence.js";

export type EvidenceBundle = {
  at: number;
  graph: Awaited<ReturnType<typeof fetchGraphEvidence>>;
  evidence: EvidenceItem[];
  graphNote: string;
};

const TTL_MS = 45_000;
const cache = new Map<string, EvidenceBundle | Promise<EvidenceBundle>>();

export async function gatherEvidence(address: string): Promise<EvidenceBundle> {
  const [graph, profile] = await Promise.all([
    fetchGraphEvidence(address),
    fetchAddressProfile(address),
  ]);

  const graphHasSubjectApprovals = graph.evidence.some(
    (e) => e.kind === "approval" && !/network context/i.test(e.title),
  );

  const rpc = graphHasSubjectApprovals
    ? {
        evidence: [] as EvidenceItem[],
        note: "RPC skipped — live Graph already has subject approvals",
      }
    : await fetchRpcApprovalEvidence(address);

  const rpcUseful = rpc.evidence.filter(
    (e) => e.id !== "rpc-empty" || !graphHasSubjectApprovals,
  );

  return {
    at: Date.now(),
    graph,
    evidence: [...graph.evidence, ...profile, ...rpcUseful],
    graphNote: graphHasSubjectApprovals
      ? `${graph.note} | ${rpc.note}`
      : `${graph.note} | ${rpc.note}`,
  };
}

/** Kick off Graph/RPC while x402 settle runs so the paid handler can reuse it. */
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
      cache.delete(key);
      return bundle;
    }
    cache.delete(key);
  }
  return gatherEvidence(address);
}
