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
        detail: "Open unpaid local scan",
      },
      {
        id: "scan",
        label: "Hunt",
        detail: "Graph evidence + grounded AI",
      },
      {
        id: "ready",
        label: "Dossier",
        detail: "Report ready (dev-bypass)",
      },
    ];
  }

  const settleDetail =
    rail === "hedera"
      ? "Agent signs ExactHederaScheme via Blocky402"
      : "Circle agent pays Gateway nanopayment";

  return [
    {
      id: "request",
      label: "Request",
      detail: "Call gated audit endpoint",
    },
    {
      id: "challenge",
      label: "402",
      detail: "Payment required — no report yet",
    },
    {
      id: "settle",
      label: "Settle",
      detail: settleDetail,
    },
    {
      id: "scan",
      label: "Hunt",
      detail: "Graph evidence + grounded AI",
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
