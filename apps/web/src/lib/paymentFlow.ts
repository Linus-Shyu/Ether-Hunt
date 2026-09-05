export type PayRail = "local" | "hedera" | "arc";

export type FlowStepId =
  | "request"
  | "challenge"
  | "settle"
  | "scan"
  | "ready";

export type FlowStep = {
  id: FlowStepId;
  label: string;
  detail: string;
};

export function flowStepsFor(rail: PayRail): FlowStep[] {
  if (rail === "local") {
    return [
      {
        id: "request",
        label: "Request",
        detail: "Open unpaid local scan channel",
      },
      {
        id: "scan",
        label: "Hunt",
        detail: "Querying Graph ApprovalEvent + grounded AI",
      },
      {
        id: "ready",
        label: "Dossier",
        detail: "Report sealed (dev-bypass · unpaid)",
      },
    ];
  }

  const settleDetail =
    rail === "hedera"
      ? "Settling USDC via Hedera ExactScheme / Blocky402"
      : "Settling nanopayment via Circle Gateway / Arc";

  return [
    {
      id: "request",
      label: "Request",
      detail: "Call gated audit endpoint",
    },
    {
      id: "challenge",
      label: "402",
      detail: "Payment required — report gated",
    },
    {
      id: "settle",
      label: "Settle",
      detail: settleDetail,
    },
    {
      id: "scan",
      label: "Hunt",
      detail: "Querying Graph Subgraph ApprovalEvent…",
    },
    {
      id: "ready",
      label: "Paid",
      detail: "Settlement confirmed · dossier ready",
    },
  ];
}

export function gatedProbePath(rail: Exclude<PayRail, "local">) {
  return rail === "hedera" ? "/api/audit" : "/api/audit/arc";
}

export function paidScanPath(rail: Exclude<PayRail, "local">) {
  return rail === "hedera" ? "/api/scan/hedera" : "/api/scan/arc";
}

export function stepIndex(steps: FlowStep[], id: FlowStepId) {
  const i = steps.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}
