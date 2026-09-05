/**
 * Mirror of `services/audit-api/src/graph.ts` APPROVAL_EVENTS_QUERY.
 * Shown verbatim in the UI so a reviewer can replay the exact subgraph call.
 */
export const APPROVAL_EVENTS_QUERY = `query ApprovalEvents($owner: Bytes!) {
  asOwner: approvalEvents(
    first: 25
    orderBy: timestamp
    orderDirection: desc
    where: { owner: $owner }
  ) { id token owner spender value timestamp transactionHash }

  asSpender: approvalEvents(
    first: 10
    orderBy: timestamp
    orderDirection: desc
    where: { spender: $owner }
  ) { id token owner spender value timestamp transactionHash }

  recentUnlimited: approvalEvents(
    first: 8
    orderBy: timestamp
    orderDirection: desc
    where: { value_gt: "100000000000000000000000000000000000000" }
  ) { id token owner spender value timestamp transactionHash }
}`;
