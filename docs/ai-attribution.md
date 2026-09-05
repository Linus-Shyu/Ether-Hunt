# AI attribution

| Area / files | Tool | Human contribution |
| --- | --- | --- |
| Monorepo scaffold, audit-api, web UI | Cursor | Product decisions, partner lock, review, prize compliance |
| `services/audit-api/src/payment.ts` Hedera x402 | Cursor + official PoC patterns | Account setup, Blocky402 wiring, live settle verification |
| `services/audit-api/src/payment-arc.ts` Circle Gateway | Cursor + `@circle-fin/x402-batching` | Arc Agent Stack buyer path via Circle CLI |
| `subgraphs/token-approvals` | Cursor | Schema choice, Studio deploy, live URL |
| `services/audit-api/src/synthesize.ts` Graph-grounded LLM | Cursor | Prompt constraints (cite-only), prize narrative |
| Web pay progress, allowance graph, PDF print | Cursor | Demo UX for payment + Graph WOW |
| Detectors / UX copy | Cursor + human | Severity taxonomy, known spender labels, demo script |

Notes:

- AI assists; it is not the entire project.
- LLM output is rejected unless `evidenceIds` exist in the live Graph/RPC evidence set.
- Keep this table updated through submission.
