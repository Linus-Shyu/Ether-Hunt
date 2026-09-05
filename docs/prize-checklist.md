# Prize qualification checklist — maximize partner odds

Honest note: **no hackathon outcome is guaranteed**. This checklist maximizes
eligibility + async reviewer clarity for the three locked seats.

**Async judges:** start with [`onchain-proofs.md`](./onchain-proofs.md) — real
HashScan / Arcscan / Gateway receipt links, no local install required.

## 1) Hedera — AI & Agentic Payments (x402 / Blocky402)

- [x] Live x402 gate on `POST /audit` (`ExactHederaScheme` + Blocky402 testnet)
- [x] ≥1 real paid request (`npm run agent:scan` / UI **Hedera → Pay & hunt** with `DEV_BYPASS_PAYMENT=false`)
- [x] ECDSA testnet accounts funded (HBAR + USDC associated)
- [x] **On-chain USDC settle proof published** (HashScan + mirror) — see below
- [ ] Demo clip: unpaid 402 → agent pays → 200 report (no speed-up)

**Reference settle (2026-09-05)** — agent `0.0.10363348` → payTo `0.0.10363255`, **$0.01 USDC** (`0.0.429274`):

- HashScan tx: https://hashscan.io/testnet/transaction/0.0.7162784@1788621320.334383663  
- Mirror JSON: https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1788621320-334383663  
- Agent account: https://hashscan.io/testnet/account/0.0.10363348  
- Service payTo: https://hashscan.io/testnet/account/0.0.10363255  

**Demo command**

```bash
# prize mode
DEV_BYPASS_PAYMENT=false ALLOW_AGENT_DEV_BYPASS=false npm run start -w @ether-hunt/audit-api
npm run agent:scan -- 0x0218033bc4c88e91a6cc9a6aceee421dda39448d
```

## 2) The Graph — Best AI Use Case (From Scratch)

- [x] Own Studio subgraph `ether-hunt-approvals` (live query URL in `.env`)
- [x] Allowance-state schema deployed as **v0.0.2** (primary)
- [x] **Sync-fallback** to tip-synced `v0.0.1` when primary subject is empty (`GRAPH_SUBGRAPH_FALLBACK_URL`)
- [x] API warms all **9 Case Files** on boot so the first judge click is a cache hit
- [x] Audit path refuses “AI invents chain facts” when Graph is down
- [x] Rule detectors grounded on Graph rows (structured links when on v0.0.2)
- [x] LLM synthesis cites evidence IDs only (`services/audit-api/src/synthesize.ts`)
- [x] Studio deployment links documented in README
- [ ] Demo clip: show Studio URL + live Graph note + `[AI]` findings
- [ ] Optional stretch: Subgraph MCP discovery call documented

**Live endpoints**

- Primary (allowance-state): https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.2  
- Fallback (tip-synced events): https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.1  
- Studio UI: https://thegraph.com/studio/subgraph/ether-hunt-approvals  

**Demo address (dense USDC approvals in indexed window)**

`0x0218033bc4c88e91a6cc9a6aceee421dda39448d`

## 3) Arc — Agentic Economy / Circle Agent Stack

- [x] Circle CLI agent wallet on `ARC-TESTNET` funded
- [x] Gateway deposit + `circle services pay` → `POST /audit/arc`
- [x] Verified `rail=arc-gateway` on paid response
- [x] **Gateway receipt + Arcscan address proofs published** — see below
- [ ] Demo clip: `npm run agent:arc` end-to-end

**Reference settle (2026-09-05)** — `GatewayWalletBatched` · `$0.01 USDC` · `eip155:5042002`:

- Gateway payment id: `39d15216-297d-4520-8b96-3a69561ccbfe`  
- Gateway payer: https://testnet.arcscan.app/address/0x3dc9f3e18f7d9cea05f740f2152d06ba17a9a648  
- Agent SCA: https://testnet.arcscan.app/address/0x810106009f15ba281d05467bf05adc05a87510ff  
- Seller payTo: https://testnet.arcscan.app/address/0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7  

Full receipt JSON + paste block: [`onchain-proofs.md`](./onchain-proofs.md).

## Submission hygiene (Classic)

- [x] Public GitHub repo — https://github.com/Linus-Shyu/Ether-Hunt  
- [x] Distinguish new vs reused in README  
- [x] On-chain payment proofs linked from README + this checklist  
- [ ] Demo video 2–4 min, ≥720p, **no speed-up**, human voice  
- [ ] Frequent incremental commits until submit  
- [ ] Update `docs/ai-attribution.md` day-of-submit  

## ETHGlobal form — paste

```text
Hedera x402 (testnet) — $0.01 USDC ExactScheme via Blocky402
Tx: https://hashscan.io/testnet/transaction/0.0.7162784@1788621320.334383663
Agent: https://hashscan.io/testnet/account/0.0.10363348
PayTo: https://hashscan.io/testnet/account/0.0.10363255

Arc Agent Stack (eip155:5042002) — $0.01 USDC GatewayWalletBatched
Gateway payment id: 39d15216-297d-4520-8b96-3a69561ccbfe
Agent SCA: https://testnet.arcscan.app/address/0x810106009f15ba281d05467bf05adc05a87510ff
Seller: https://testnet.arcscan.app/address/0x96Fa683C2Ca1CE3528F8bF88a48fAB79B011D2a7

The Graph — ether-hunt-approvals v0.0.2 (+ v0.0.1 sync-fallback)
https://thegraph.com/studio/subgraph/ether-hunt-approvals
```

## Ranking realism

Partner prizes reward **working integrations that judges can verify**.  
Finalist ranking still needs WOW — keep AI narrative + dual payment rails front-and-center in the video first 60 seconds.
