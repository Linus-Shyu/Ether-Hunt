# On-chain settlement proofs (async judge pack)

Judges do **not** need to run `npm install` to verify the locked payment rails.
Every link below is a live explorer / mirror-node record from a real $0.01 USDC
settle into Ether Hunt’s payTo accounts.

Captured: **2026-09-05** (UTC+8). Re-run `POST /scan/hedera` or `POST /scan/arc`
anytime to mint a fresher proof; the API attaches `sources.payment.explorerUrl`
on each paid report.

---

## Hedera — AI & Agentic Payments (x402 / Blocky402)

| Field | Value |
| --- | --- |
| Network | `hedera:testnet` |
| Facilitator | Blocky402 `https://api.testnet.blocky402.com` |
| Scheme | `ExactHederaScheme` / exact |
| Asset | USDC HTS `0.0.429274` |
| Amount | **10 000** base units = **$0.01** |
| Payer (agent) | [`0.0.10363348`](https://hashscan.io/testnet/account/0.0.10363348) |
| PayTo (service) | [`0.0.10363255`](https://hashscan.io/testnet/account/0.0.10363255) |
| Rail on report | `hedera-x402` · `settled=true` |

### Reference settle tx (click this first)

- **HashScan:** https://hashscan.io/testnet/transaction/0.0.7162784@1788621320.334383663  
- **Mirror API (machine check):** https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1788621320-334383663  

Mirror excerpt (same tx):

```json
{
  "transaction_id": "0.0.7162784-1788621320-334383663",
  "name": "CRYPTOTRANSFER",
  "result": "SUCCESS",
  "token_transfers": [
    { "token_id": "0.0.429274", "account": "0.0.10363255", "amount": 10000 },
    { "token_id": "0.0.429274", "account": "0.0.10363348", "amount": -10000 }
  ]
}
```

Earlier settles on the same corridor (same agent → payTo, same $0.01 USDC):

- https://hashscan.io/testnet/transaction/0.0.7162784@1788619482.353824930  
- https://hashscan.io/testnet/transaction/0.0.7162784@1788618395.623909292  

---

## Arc — Circle Agent Stack / Gateway nanopayment

| Field | Value |
| --- | --- |
| Network | `eip155:5042002` (Arc Testnet) |
| Facilitator | `https://gateway-api-testnet.circle.com` |
| Scheme | `GatewayWalletBatched` |
| Amount | **$0.01 USDC** |
| Agent wallet (SCA) | [`0x810106009f15ba281d05467bf05adc05a87510ff`](https://testnet.arcscan.app/address/0x810106009f15ba281d05467bf05adc05a87510ff) |
| Seller / payTo | [`0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7`](https://testnet.arcscan.app/address/0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7) |
| Rail on report | `arc-gateway` · `settled=true` |

### Reference Gateway receipt (from `circle services pay --output json`)

Decoded `data.payment.receipt` after a successful `POST /audit/arc` settle:

```json
{
  "success": true,
  "payer": "0x3dc9f3e18f7d9cea05f740f2152d06ba17a9a648",
  "transaction": "39d15216-297d-4520-8b96-3a69561ccbfe",
  "network": "eip155:5042002"
}
```

Payment envelope from the same call:

```json
{
  "amount": "$0.01 USDC",
  "chain": "eip155:5042002",
  "scheme": "GatewayWalletBatched",
  "seller": "0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7"
}
```

Gateway-batched settles surface a **Circle payment id** (`transaction` UUID) plus
the payer Gateway wallet. Open the Arcscan address pages above to inspect the
agent / seller activity on Arc Testnet; the report also links them as
`agentExplorerUrl` / `explorerUrl`.

---

## Paste block for ETHGlobal submission form

```text
Hedera x402 (testnet) — $0.01 USDC ExactScheme via Blocky402
Tx: https://hashscan.io/testnet/transaction/0.0.7162784@1788621320.334383663
Agent: https://hashscan.io/testnet/account/0.0.10363348
PayTo: https://hashscan.io/testnet/account/0.0.10363255
Mirror: https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1788621320-334383663

Arc Agent Stack (eip155:5042002) — $0.01 USDC GatewayWalletBatched
Gateway payment id: 39d15216-297d-4520-8b96-3a69561ccbfe
Payer: https://testnet.arcscan.app/address/0x3dc9f3e18f7d9cea05f740f2152d06ba17a9a648
Agent SCA: https://testnet.arcscan.app/address/0x810106009f15ba281d05467bf05adc05a87510ff
Seller payTo: https://testnet.arcscan.app/address/0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7
```

---

## How we re-verify locally

```bash
# prize mode API already running with DEV_BYPASS_PAYMENT=false
curl -sS -X POST http://127.0.0.1:8787/scan/hedera \
  -H 'content-type: application/json' \
  -d '{"chainId":1,"address":"0x0218033bc4c88e91a6cc9a6aceee421dda39448d"}' \
  | jq '.sources.payment'

curl -sS -X POST http://127.0.0.1:8787/scan/arc \
  -H 'content-type: application/json' \
  -d '{"chainId":1,"address":"0x0218033bc4c88e91a6cc9a6aceee421dda39448d"}' \
  | jq '.sources.payment'
```
