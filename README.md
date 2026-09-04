# Ether Hunt

ETHOnline 2026 · Classic (From Scratch) · **Sep 4–16, 2026**  
Submit by **Sep 13, 2026 12:00 EDT**

## Idea

**Pay-per-scan AI on-chain audit** with evidence you can verify:

1. **The Graph** — live subgraph evidence (approvals → more detectors next)
2. **AI / rules** — grounded findings (citations required)
3. **Hedera x402** — paywall the audit API (Blocky402)
4. **Arc Agent Stack** — agent consumer that pays and calls the service

## Locked partners (max 3)

| Partner | Track |
| --- | --- |
| Hedera | AI & Agentic Payments (x402) |
| The Graph | Best AI Use Case (**From Scratch**) |
| Arc | Best Agentic Economy / Circle Agent Stack |

## Run locally

```bash
cd "Ether Hunt"
npm install
npm run build -w @ether-hunt/shared  # optional typecheck
npm run dev:api   # http://127.0.0.1:8787
npm run dev:web   # http://127.0.0.1:5173
```

Env: copy `.env.example`. For Graph prize eligibility set `GRAPH_SUBGRAPH_URL` (+ `GRAPH_API_KEY` if needed).  
`DEV_BYPASS_PAYMENT=true` is for local only — **not** for Hedera prize demos.

## Layout

```
apps/web              Vite + React UI
services/audit-api    Hono API (payment gate + Graph + analysis)
packages/shared       Shared report types
docs/                 Decisions, prize architecture, official links
.cursor/rules/        ETHOnline compliance rules
```

## Reused vs new

| Reused / planned boilerplate | New |
| --- | --- |
| Hedera x402 official PoC patterns (upcoming) | Product UX, report schema, detectors |
| Circle Agent Stack starter (upcoming) | Audit orchestration |
| Public subgraph schemas | Finding synthesis + citations |

## AI usage

See `docs/ai-attribution.md`.

## Status (kickoff day)

- [x] Partner lock + monorepo scaffold
- [x] UI → API audit path (dev payment bypass)
- [ ] Live Graph endpoint wired with Studio key
- [ ] Real Blocky402 x402 settle
- [ ] Arc agent consumer
- [ ] Public GitHub + frequent commits
