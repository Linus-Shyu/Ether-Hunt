# Prize qualification checklist — maximize partner odds

Honest note: **no hackathon outcome is guaranteed**. This checklist maximizes
eligibility + async reviewer clarity for the three locked seats.

## 1) Hedera — AI & Agentic Payments (x402 / Blocky402)

- [x] Live x402 gate on `POST /audit` (`ExactHederaScheme` + Blocky402 testnet)
- [x] ≥1 real paid request (`npm run agent:scan` with `DEV_BYPASS_PAYMENT=false`)
- [x] ECDSA testnet accounts funded (HBAR + USDC associated)
- [ ] Demo clip: unpaid 402 → agent pays → 200 report (no speed-up)
- [ ] README payment flow section screenshots / HashScan links

**Demo command**

```bash
# prize mode
DEV_BYPASS_PAYMENT=false ALLOW_AGENT_DEV_BYPASS=false npm run start -w @ether-hunt/audit-api
npm run agent:scan -- 0x0218033bc4c88e91a6cc9a6aceee421dda39448d
```

## 2) The Graph — Best AI Use Case (From Scratch)

- [x] Own Studio subgraph `ether-hunt-approvals` (live query URL in `.env`)
- [x] Audit path refuses “AI invents chain facts” when Graph is down
- [x] Rule detectors grounded on Graph ApprovalEvent rows
- [x] LLM synthesis cites evidence IDs only (`services/audit-api/src/synthesize.ts`)
- [ ] Demo clip: show Studio URL + live Graph note + `[AI]` findings
- [ ] Optional stretch: Subgraph MCP discovery call documented

**Demo address (dense USDC approvals in indexed window)**

`0x0218033bc4c88e91a6cc9a6aceee421dda39448d`

## 3) Arc — Agentic Economy / Circle Agent Stack

- [x] Circle CLI agent wallet on `ARC-TESTNET` funded
- [x] Gateway deposit + `circle services pay` → `POST /audit/arc`
- [x] Verified `rail=arc-gateway` on paid response
- [ ] Demo clip: `npm run agent:arc` end-to-end
- [ ] README Agent Stack architecture diagram

## Submission hygiene (Classic)

- [x] Public GitHub repo
- [x] Distinguish new vs reused in README
- [ ] Demo video 2–4 min, ≥720p, **no speed-up**, human voice
- [ ] Frequent incremental commits until submit
- [ ] Update `docs/ai-attribution.md` day-of-submit

## Ranking realism

Partner prizes reward **working integrations that judges can verify**.  
Finalist ranking still needs WOW — keep AI narrative + dual payment rails front-and-center in the video first 60 seconds.
