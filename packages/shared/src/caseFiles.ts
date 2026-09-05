/**
 * Judge-facing Case Files — every address is verified to return subject-scoped
 * USDC approval rows on the fully-synced Studio deployment (v0.0.1 today).
 *
 * While allowance-state v0.0.2 is still catching up from startBlock, the API
 * falls back to GRAPH_SUBGRAPH_FALLBACK_URL so async reviewers never open an
 * empty dossier from these presets.
 */
export type CaseFilePreset = {
  label: string;
  value: string;
  note: string;
};

export const CASE_FILES: CaseFilePreset[] = [
  {
    label: "Widest exposure",
    value: "0x00000f91109c4d0007e90000d9facad5298a0cac",
    note: "Contract · dozens of live unlimited grants, most to unnamed spenders",
  },
  {
    label: "Re-approval storm",
    value: "0x634826fb67d4eb9633f0011fae8e23cf99acd6f0",
    note: "Contract · dense unlimited churn across many spenders",
  },
  {
    label: "Unnamed spenders",
    value: "0x63242a4ea82847b20e506b63b0e2e2eff0cc6cb0",
    note: "Contract · six escalations alongside a recognised Permit2 grant",
  },
  {
    label: "Half recognised",
    value: "0x4a6c312ec70e8747a587ee860a0353cd42be0ae0",
    note: "Contract · Morpho and vault grants named, four unnamed escalated",
  },
  {
    label: "Allowance-state window",
    value: "0xf081470f5c6fbccf48cc4e5b82dd926409dcdd67",
    note: "Early-index subject · already folded on v0.0.2 while tip catch-up runs",
  },
  {
    label: "Short enough to read",
    value: "0xbbc133749e308694277aaa82ac780eb8aaed77f6",
    note: "Contract · three escalations, small enough to check end to end",
  },
  {
    label: "Named DeFi stack",
    value: "0x4de4fccc14eab1d69890a49471a9d57b96dd725f",
    note: "Contract · Morpho, Balancer and Curve identified — one outlier left",
  },
  {
    label: "No false alarms",
    value: "0x0218033bc4c88e91a6cc9a6aceee421dda39448d",
    note: "Wallet · unlimited to Permit2 and Circle, so nothing escalates",
  },
  {
    label: "vitalik.eth",
    value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    note: "Clean baseline · scores low, which is how you know high means something",
  },
];

export const CASE_FILE_ADDRESSES: readonly string[] = CASE_FILES.map((c) =>
  c.value.toLowerCase(),
);

export function isCaseFileAddress(address: string): boolean {
  return CASE_FILE_ADDRESSES.includes(address.trim().toLowerCase());
}
