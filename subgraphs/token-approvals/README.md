# Token Approvals subgraph (The Graph)

Indexes `Approval` events for a configured ERC-20 (default USDC) so Ether Hunt can query live allowance evidence.

## Deploy (needs your Studio key)

```bash
cd subgraphs/token-approvals
npm install --no-workspaces --install-strategy=nested
npx graph auth <DEPLOY_KEY>
npx graph codegen && npx graph build
npx graph deploy ether-hunt-approvals \
  --node https://api.studio.thegraph.com/deploy/ \
  --deploy-key <DEPLOY_KEY> \
  --version-label v0.0.1
```

Then set in `.env` (example after first deploy):

```
GRAPH_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.1
```

Update `subgraph.yaml` `source.address` / `startBlock` for the tokens you care about, or expand to a templates-based multi-token design.
