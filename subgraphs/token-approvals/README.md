# Token Approvals subgraph (The Graph)

Indexes `Approval` events for a configured ERC-20 (default USDC) so Ether Hunt can query live allowance evidence.

## Deploy (needs your Studio key)

```bash
npm install -g @graphprotocol/graph-cli
graph codegen
graph build
graph auth --studio <DEPLOY_KEY>
graph deploy --studio ether-hunt-approvals
```

Then set in `.env`:

```
GRAPH_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<ID>/ether-hunt-approvals/<VERSION>
```

Update `subgraph.yaml` `source.address` / `startBlock` for the tokens you care about, or expand to a templates-based multi-token design.
