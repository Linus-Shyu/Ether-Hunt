# Project decisions

Last updated: 2026-09-04 (ETHOnline kickoff — product coding allowed)

## Track

- [x] Classic (From Scratch) — **locked**
- [ ] Continuity

Hard rules: `docs/ethglobal-hard-rules.md`

## Locked partner prizes (max 3) — prize-fit rationale

| # | Partner | Track | Why it fits Ether Hunt |
| --- | --- | --- | --- |
| 1 | **Hedera** | AI & Agentic Payments / x402 | Audit API is a pay-per-scan service; Blocky402 settles real paid requests |
| 2 | **The Graph** | Best AI Use Case **(From Scratch)** | Risk-monitor agent uses **live** subgraph evidence (approvals / admin / pause), not LLM-only |
| 3 | **Arc** | Best Agentic Economy / Circle Agent Stack | Consumer agent holds wallet, pays USDC, calls the gated audit service |

**Not selected (weaker fit or dilutes focus):** 1inch Aqua, Uniswap AMM, World Selfie/AgentKit Continuity, ENS-only, Privy B2B, Chainlink CRE TEE, Ledger Agent Stack (interesting x402 overlap but third seat reserved for Arc), Bazantic.

**Out:** 0G (not on prize page).

## Product

**Ether Hunt** — metered AI on-chain audit:

Graph live evidence → grounded findings → Hedera x402 paywall → Arc agent as paying consumer (seat 3).

Finding focus v1: **approvals · access control · upgradeability**.

## Stack

- Monorepo (npm workspaces)
- `apps/web` — Vite + React UI
- `services/audit-api` — Hono API (x402 gate + orchestration)
- `packages/shared` — report/evidence types
