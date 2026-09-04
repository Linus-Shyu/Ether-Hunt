# Prize architecture — Hedera × The Graph × Arc

Updated after prize-page refresh (Graph From Scratch AI track live; 0G removed; Arc details published).

## One pipeline

```
User / Agent
    │
    ├─ pay (x402 on Hedera, Blocky402)
    │     optional: Arc agent / USDC via Circle Agent Stack
    ▼
Audit API (x402-gated)
    │
    ├─ fetch source (Sourcify / explorer)
    ├─ query The Graph live (behavioral evidence)
    ├─ static hints (optional Slither)
    ├─ LLM synthesize findings (cite evidence)
    └─ persist report (repo / object storage — document clearly)
    ▼
Report UI + JSON artifact
```

## Per-partner “must show in demo”

| Partner | Must be visibly used | Hard gate |
| --- | --- | --- |
| Hedera | Real paid request unlocks or runs audit | Live x402 service + consumer path + README payment flow; Blocky402; demo ≤5 min for partner clip |
| The Graph | Timeline/stats that feed findings (not decoration) | Live Subgraph Studio / Graph Market data; From Scratch AI Use Case pool; mock-only does **not** qualify |
| Arc | Agent pays/consumes or settles with USDC tooling | Working MVP + architecture diagram; Agent Stack / App Kits as applicable |

## Finding focus (depth over breadth)

1. Unlimited / risky ERC-20 approvals
2. Centralized admin / pause / upgrade powers
3. Proxy / upgradeability footguns
4. (Stretch) oracle / price-sensitive paths if Chainlink prize text later fits as free add-on

## Module boundaries (to create after kickoff)

- `apps/web` — paste address, pay, view report
- `services/audit-api` — x402 gate + orchestration
- `packages/graph` — subgraph / MCP query client
- `packages/analysis` — static + LLM prompts (citation-required)
- `packages/settlement` — Hedera x402 / Blocky402
- `packages/agent-arc` — optional Circle Agent Stack consumer

## Pre-kickoff checklist (docs only — no product code)

- [ ] Confirm Classic track on Hacker Dashboard
- [ ] Read Hedera x402 PoC: https://github.com/hedera-dev/x402-inference-pay-per-request-poc
- [ ] Read Graph From Scratch AI prize requirements on prizes page
- [ ] Skim Circle Agent Stack starter: https://github.com/circlefin/agent-stack-starter-kits
- [ ] Prepare Hedera testnet account + Blocky402 notes
- [ ] Prepare The Graph Subgraph Studio API key
- [ ] Pick 1 known-vulnerable + 1 cleaner demo contract (addresses only — no project code yet)

## Build order (during event, after 2026-09-04)

1. Thin end-to-end shell (UI + report shape) with **feature flags**; swap mocks → live ASAP
2. Real Graph live queries wired into findings
3. Real x402 pay path (Hedera qualification-critical)
4. Harden citations + demo script
5. Arc agent path only if seats 1–2 are solid
6. README: architecture, payment flow, AI attribution, reused vs new; frequent small commits
