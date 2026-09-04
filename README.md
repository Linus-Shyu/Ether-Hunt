# Ether Hunt

ETHOnline 2026 · Classic (From Scratch) · **Sep 4–16, 2026**  
Submit by **Sep 13, 2026 12:00 EDT**  
Repo: public GitHub · Partner seats: **Hedera x402 · The Graph AI From Scratch · Arc Agent Stack**

## Idea

**Pay-per-scan on-chain audit** where every claim is backed by live chain evidence:

1. **The Graph** — From-Scratch Studio subgraph (`ApprovalEvent`) as the evidence source of truth  
2. **AI** — Graph-grounded synthesis that may only cite real evidence IDs (no invented txs)  
3. **Hedera x402** — ExactHederaScheme paywall via Blocky402 testnet  
4. **Arc Agent Stack** — Circle agent wallet pays Gateway nanopayments to `/audit/arc`

## Locked partners (max 3)

| Partner | Track | Proof in product |
| --- | --- | --- |
| Hedera | AI & Agentic Payments (x402) | `POST /audit` + `npm run agent:scan` |
| The Graph | Best AI Use Case (**From Scratch**) | Studio subgraph + `ai` narrative/findings |
| Arc | Best Agentic Economy / Circle Agent Stack | `POST /audit/arc` + `npm run agent:arc` |

Judge packs: `docs/prize-checklist.md` · `docs/demo-script.md` · `docs/ai-attribution.md`

## Run locally

```bash
cd "Ether Hunt"
npm install
npm run dev:api   # http://127.0.0.1:8787
npm run dev:web   # http://localhost:5173
```

Copy `.env.example` → `.env`. Set `GRAPH_SUBGRAPH_URL` and LLM key (`ANTHROPIC_API_KEY`) for the AI path.

- `DEV_BYPASS_PAYMENT=true` — local UI only  
- Prize payment demos require `DEV_BYPASS_PAYMENT=false`

**Web one-click pay:** pick rail in the UI → `POST /scan/hedera` or `POST /scan/arc` (server agent wallets settle; gated `/audit` stays prize-valid).

Paid agents (CLI):

```bash
npm run agent:scan   # Hedera x402 → POST /audit
npm run agent:arc    # Circle Agent Stack → POST /audit/arc
```

Dense Graph demo address: `0x0218033bc4c88e91a6cc9a6aceee421dda39448d`

## Architecture (short)

```
UI / Hedera agent / Arc agent
        │
        ▼
 audit-api  ── Graph Studio subgraph (live ApprovalEvent)
        │      + rule detectors
        │      + LLM synthesis (cite-only)
        ▼
   AuditReport (findings + evidence + ai)
```

Payments:

- Hedera rail: `@x402/hedera` ExactScheme → Blocky402 testnet facilitator  
- Arc rail: `@circle-fin/x402-batching` GatewayEvmScheme → Circle Gateway testnet + `circle services pay`

## Layout

```
apps/web                 Vite + React scan UI
services/audit-api       Hono API (dual payment + Graph + AI)
packages/agent-consumer  Hedera + Arc paying agents
packages/shared          Report types
subgraphs/token-approvals Studio subgraph (From Scratch)
docs/                    Prize / demo / decisions
```

## Reused vs new

| Reused | New |
| --- | --- |
| `@x402/hono`, `@x402/hedera`, Hedera PoC patterns | Audit product, report schema, detectors |
| `@circle-fin/x402-batching`, Circle CLI Agent Stack | `/audit/arc` Gateway gate + `agent:arc` |
| graph-cli / graph-ts | `ether-hunt-approvals` subgraph + grounded AI path |

## AI usage

See `docs/ai-attribution.md`. AI assists; humans own prize selection, credentials, demo, and compliance.

## Status

- [x] Hedera x402 live settle  
- [x] Graph Studio live URL + denser findings  
- [x] Arc Agent Stack Gateway pay  
- [x] Graph-grounded LLM synthesis  
- [ ] Submission demo video (≤4 min, no speed-up)
