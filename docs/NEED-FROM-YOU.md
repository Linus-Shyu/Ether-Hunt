# Need from you (authorization / secrets)

Automation stopped needing these — everything else that can be done without secrets is in the repo.

## 1. The Graph (prize-critical)

1. Open https://thegraph.com/studio/
2. Create API / deploy key
3. Deploy `subgraphs/token-approvals` (see its README)
4. Put the Studio query URL in `.env` as `GRAPH_SUBGRAPH_URL=...`

Until then: API uses Ethereum RPC approval logs as **temporary** evidence (explicitly marked not Graph).

## 2. Hedera x402 (prize-critical)

1. Create 2 ECDSA accounts on https://portal.hedera.com (service receiver + agent payer)
2. Fund testnet HBAR (+ USDC from Circle faucet if paying USDC)
3. Set in `.env`:
   - `HEDERA_SERVICE_ACCOUNT_ID=0.0.x`
   - `DEV_BYPASS_PAYMENT=false`
4. For agent signing: official PoC uses `@x402/hedera`, but npm currently fails (`@hiero-ledger/proto@2.31.0` missing). Workarounds:
   - Run payment signing via the [official PoC](https://github.com/hedera-dev/x402-inference-pay-per-request-poc) and pass `PAYMENT_HEADER=...` into our agent, or
   - Tell me when `@x402/hedera` installs cleanly and I’ll wire ExactHederaScheme.

## 3. Arc Agent Stack

Clone/adapt https://github.com/circlefin/agent-stack-starter-kits with your Circle/Arc credentials when ready. Our `packages/agent-consumer` is the call-site stub.

## 4. Public GitHub

If `gh repo create` succeeds automatically, ignore this. If it asks for confirmation or fails, run:

```bash
cd "/Users/linusshyu/Desktop/Ether Hunt"
gh repo create Ether-Hunt --public --source=. --remote=origin --push
```
