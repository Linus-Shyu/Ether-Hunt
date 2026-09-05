# Ether Hunt

**ETHOnline 2026 · Classic (From Scratch)**  
Kickoff: **2026-09-04** · Submit by **Sun Sep 13, 2026 12:00 pm EDT** (no late submissions)  
Public repo: https://github.com/Linus-Shyu/Ether-Hunt  

**Locked partner seats (max 3):** Hedera (x402) · The Graph (AI Use Case From Scratch) · Arc (Circle Agent Stack)

---

## Idea

Ether Hunt is a **pay-per-scan on-chain allowance audit**.

1. An agent (or the web UI buyer proxy) pays for one scan.  
2. The API loads **live** `ApprovalEvent` evidence from our **From-Scratch** The Graph Studio subgraph.  
3. Rule detectors + an LLM produce findings that may **only cite real evidence IDs** (no invented txs).  
4. The UI shows a dossier: AI brief, **allowance relationship graph**, findings, evidence ledger, PDF export, and share.

This is built for Classic judging priorities: **Technicality → Originality → Practicality → Usability → WOW**, with real protocol integrations over mocks.

---

## Locked partners — what we built

| # | Partner | Track | How we qualify | How to verify |
| --- | --- | --- | --- | --- |
| 1 | **Hedera** | AI & Agentic Payments (x402 / Blocky402) | Live x402 gate on `POST /audit` via `ExactHederaScheme` + Blocky402 testnet; agent completes ≥1 real paid request | `DEV_BYPASS_PAYMENT=false` → unpaid `POST /audit` returns **402** → `npm run agent:scan` or UI **Hedera → Pay & hunt** → report `sources.payment.rail = hedera-x402` |
| 2 | **The Graph** | Best AI Use Case — **From Scratch** | Own Studio subgraph `ether-hunt-approvals` that folds raw approvals into **live allowance state** (`Allowance` / `Account` / `Spender`) instead of mirroring logs; cite-only AI grounded on those rows | Set `GRAPH_SUBGRAPH_URL`; scan Dense USDC address; dossier shows **Graph LIVE**, the schema mode, and a **Copy subgraph query** button holding the exact GraphQL that ran |
| 3 | **Arc** | Best Agentic Economy / Circle Agent Stack | `POST /audit/arc` Gateway nanopayments; Circle agent wallet pays via `circle services pay --chain ARC-TESTNET` | `npm run agent:arc` or UI **Arc → Pay & hunt** → `rail = arc-gateway` |

Judge packs (detail): [`docs/prize-checklist.md`](docs/prize-checklist.md) · [`docs/demo-script.md`](docs/demo-script.md) · [`docs/ai-attribution.md`](docs/ai-attribution.md)

---

## Verify it yourself in 60 seconds

The UI is built so no claim has to be taken on trust:

1. **Prove the gate.** In the hero, press **Prove the gate**. The browser sends one
   *unpaid* request to the gated endpoint and renders the raw HTTP `402` challenge
   decoded from the `payment-required` header — scheme, network, price, asset,
   `payTo`. Hedera shows `exact` on `hedera:testnet`; Arc shows
   `GatewayWalletBatched` on `eip155:5042002`.
2. **Pay & hunt.** The agent settles $0.01 USDC, then the scan runs. The
   **Verifiable rails** panel flips the matching card to `PROVEN` and links the
   settlement — HashScan transfer tx for Hedera, agent wallet for Arc.
3. **Check the grounding.** The Graph card shows the live endpoint, the number of
   real `ApprovalEvent` rows cited, and a **Copy subgraph query** button holding
   the exact GraphQL the API ran. Every finding lists its cite count.
4. **Confirm it is useful.** The dossier ranks revocable spenders and links each
   one out to revoke.cash, so the audit ends in an action rather than a verdict.
5. **Confirm it is honest.** Scan `vitalik.eth` from **Case files** — the exposure
   gauge stays low, which is how you know the high scores mean something.

---

## Architecture

```
┌──────────────┐   pay rails    ┌─────────────────┐
│ apps/web     │───────────────▶│ audit-api :8787 │
│ Pay progress │  /scan/hedera  │  x402 Hedera    │
│ Allowance    │  /scan/arc     │  Gateway Arc    │
│ graph · PDF  │  /scan/local   │  /audit (402)   │
└──────────────┘                │  /audit/arc     │
                                └────────┬────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     The Graph Studio          Rule detectors over           DeepSeek / LLM
     ether-hunt-approvals      structured links +            cite-only synthesis
     Allowance / Account /     address registry
     Spender (live state)
              │
              ▼
                    AuditReport { findings, evidence, ai, payment }
```

**Payment flow (prize mode)**

1. Client hits gated `POST /audit` (or `/audit/arc`) → **HTTP 402** Payment Required.  
2. Hedera agent (`ExactHederaScheme` + Blocky402) **or** Arc Circle agent (`circle services pay` / Gateway) settles USDC.  
3. Retry / paid buyer path returns **200** + dossier.  
4. Report records `sources.payment.rail` ∈ `hedera-x402` | `arc-gateway` | `dev-bypass`.

Web UI shows a **payment progress** strip: Request → 402 → Settle → Hunt → Paid,
plus a **Prove the gate** control that renders the decoded 402 challenge without
paying, and a **Verifiable rails** panel that links each partner's settlement
artefact once it exists.

Local rail uses `POST /scan/local` (**unpaid / `dev-bypass`**) — for UI only, **not** a prize payment proof.

---

## Subgraph: allowance state, not an event mirror

`subgraphs/token-approvals` deliberately does more than re-emit `Approval` logs,
because the log stream cannot answer the only question that matters to a holder:
**is this allowance still spendable right now?**

The mapping folds every log into three entities:

| Entity | What it holds | Why the audit needs it |
| --- | --- | --- |
| `Allowance` | Live value, `unlimited`, `revoked`, peak value, re-approval count per `(token, owner, spender)` | Distinguishes a live infinite approval from one that was granted in 2024 and revoked the same day |
| `Account` | Per-owner `liveUnlimitedCount`, grants, revokes, distinct spender pairs | Standing exposure without replaying history |
| `Spender` | Per-spender `liveUnlimitedCount`, `distinctOwnerPairs` | Blast radius — how many wallets one contract compromise would drain |

`unlimited` and `revoke` are classified at index time, so detectors read booleans
instead of re-parsing value strings. `Account.liveUnlimitedCount` is maintained by
tracking boundary crossings on each pair, not by rescanning allowance lists.

**Schema compatibility.** A new deployment must resync from `startBlock`, so the
API probes the allowance-state query, caches which schema the endpoint speaks, and
falls back to the raw-log query while an older deployment is still serving. The
dossier reports which mode answered.

```bash
cd subgraphs/token-approvals
npx graph codegen && npx graph build
npx graph auth <STUDIO_DEPLOY_KEY>
npx graph deploy ether-hunt-approvals    # bump to v0.0.2
```

**Indexed window caveat:** the manifest tracks mainnet USDC from
`startBlock: 19000000` (2024-01-13). Addresses whose activity predates that block
have no subject-scoped rows by construction, and the dossier says so rather than
inventing findings.

---

## Quick start

```bash
git clone https://github.com/Linus-Shyu/Ether-Hunt.git
cd Ether-Hunt
cp .env.example .env   # fill Graph URL, Hedera/Arc keys, LLM key — never commit .env
npm install

# Terminal A — prize payments need bypass OFF
DEV_BYPASS_PAYMENT=false ALLOW_AGENT_DEV_BYPASS=false npm run start -w @ether-hunt/audit-api

# Terminal B
npm run dev:web   # http://localhost:5173
```

### Env (see `.env.example`)

| Variable | Purpose |
| --- | --- |
| `GRAPH_SUBGRAPH_URL` | Studio query URL for `ether-hunt-approvals` (**required** for Graph prize) |
| `HEDERA_SERVICE_ACCOUNT_ID` / `HEDERA_AGENT_*` | x402 payTo + agent signer (ECDSA) |
| `X402_PRICE='$0.01'` | Quote prices — shell expands bare `$0.01` incorrectly |
| `ARC_SERVICE_ADDRESS` / `ARC_AGENT_ADDRESS` | Arc seller payTo + Circle agent wallet |
| `DEEPSEEK_API_KEY` (or Anthropic/OpenAI) | Graph-grounded LLM |
| `DEV_BYPASS_PAYMENT` | `true` = local free scans; **`false` for prize demos** |

### Demo address (dense Graph approvals)

```
0x0218033bc4c88e91a6cc9a6aceee421dda39448d
```

### Paid agents (CLI)

```bash
npm run agent:scan -- 0x0218033bc4c88e91a6cc9a6aceee421dda39448d   # Hedera x402
npm run agent:arc                                                    # Arc Gateway
```

### Prove the gate (Hedera)

```bash
# Expect 402 when bypass is false
curl -i -X POST http://127.0.0.1:8787/audit \
  -H 'content-type: application/json' \
  -d '{"chainId":1,"address":"0x0218033bc4c88e91a6cc9a6aceee421dda39448d"}'
```

---

## Repo layout

```
apps/web/src/App.tsx            State + payment orchestration only
apps/web/src/components/        TerminalHeader · ScanConsole · ChallengeViewer
                                ProofRail · CaseFiles · Dossier · RiskMeter
                                AllowanceGraph (React Flow + d3-force)
apps/web/src/lib/               api (402 decode) · risk (score, revocations)
                                paymentFlow · reportPdf · reportShare · graphQuery
services/audit-api          Hono: dual payment + Graph + detectors + AI
packages/agent-consumer     Hedera + Arc paying agents (CLI + libs for web proxy)
packages/shared             AuditReport / evidence types
subgraphs/token-approvals   From-Scratch Studio subgraph
docs/                       Prize checklist, demo script, AI attribution
scripts/                    Hedera USDC associate helper
```

Live Graph (example Studio deployment used in demos):

`https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.1`

---

## Reused vs new (Classic)

| Reused (public OSS / official kits) | New (this project) |
| --- | --- |
| `@x402/hono`, `@x402/hedera`, Blocky402 facilitator patterns | Product: pay-per-scan audit, report schema, detectors |
| `@circle-fin/x402-batching`, Circle CLI Agent Stack / Gateway | `/audit/arc` gate, `agent:arc`, web `/scan/*` buyers |
| `@graphprotocol/graph-cli` / `graph-ts` | `ether-hunt-approvals` subgraph + Studio deploy |
| Vite, React, Hono, Zod | Web dossier UX, allowance graph, payment progress, PDF print sheet |
| LLM HTTP APIs (DeepSeek / etc.) | Cite-only Graph-grounded synthesizer (`synthesize.ts`) |

Boilerplate is limited to standard tooling; **all prize integrations and the audit product logic are new work started after Classic kickoff (2026-09-04)**.

---

## AI usage (ETHOnline compliance)

AI (including Cursor) **assists**; it is **not** the entire project.

| Area | Tool | Human ownership |
| --- | --- | --- |
| Monorepo, audit-api, web | Cursor | Product/partner lock, review, credentials, demo |
| Hedera x402 / Arc Gateway wiring | Cursor + official SDKs | Account setup, live settle verification |
| Subgraph schema + Studio deploy | Cursor | Deploy, live URL, indexing choices |
| Graph-grounded LLM prompts | Cursor | Cite-only constraint, prize narrative |
| Design / demo script | Cursor + human | Brand direction, ≤4 min video, compliance |

Full table: [`docs/ai-attribution.md`](docs/ai-attribution.md).

**Runtime AI rule:** synthesis is discarded unless every `evidenceIds` entry exists in the live evidence set.

---

## Submission artifacts

- [x] Public GitHub + setup instructions (this README)  
- [x] New vs reused distinguished  
- [x] Partner integrations documented (payment + Graph + Agent Stack)  
- [x] Incremental git history (no single mega-dump)  
- [ ] Demo video **2–4 min**, ≥720p, **no speed-up**, human voice (not TTS) — see `docs/demo-script.md`  
- [ ] Optional Figma / design notes if judges request UI provenance  

---

## Security notes

- Never commit `.env`, private keys, or deploy keys.  
- Prefer testnet for demos; validate addresses; keep approvals/payment amounts explicit.  
- `DEV_BYPASS_PAYMENT` / `/scan/local` are for development only.

---

## Status

| Capability | State |
| --- | --- |
| Hedera x402 live settle | Done |
| Graph Studio live + denser findings | Done |
| Arc Agent Stack Gateway pay | Done |
| Graph-grounded LLM + cite-only | Done |
| Web pay progress + one-click Hedera/Arc | Done |
| Allowance relationship graph | Done |
| PDF / share dossier | Done |
| Submission demo video ≤4 min | **TODO** |
