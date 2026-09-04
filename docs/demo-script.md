# Demo script ≤ 4 minutes (no speed-up)

Target: async partner reviewers + Classic judges.

## Prep (before record)

1. API with prize payments:

```bash
cd "/Users/linusshyu/Desktop/Ether Hunt"
# temporary shell override for recording
DEV_BYPASS_PAYMENT=false ALLOW_AGENT_DEV_BYPASS=false npm run start -w @ether-hunt/audit-api
```

2. Second terminal: web UI `npm run dev:web`
3. Circle CLI still logged in (testnet) for Arc segment
4. Browser tabs: Studio subgraph, HashScan (optional), localhost:5173

## Minute 0:00–0:40 — Hook

- Show Ether Hunt landing + three partner pills
- One sentence: “Pay-per-scan audit grounded on live Graph evidence, settled with Hedera x402 and Arc Agent Stack.”

## Minute 0:40–1:40 — The Graph + AI

- Paste `0x0218033bc4c88e91a6cc9a6aceee421dda39448d`
- Scan (for UI you may briefly use bypass OR show a pre-paid agent result)
- Zoom: Graph live note, unlimited approvals, AI synthesis box, `[AI]` findings citing evidence
- Flash Studio query URL proving From-Scratch subgraph

## Minute 1:40–2:40 — Hedera x402

- Terminal: `npm run agent:scan -- 0x0218…`
- Show first unpaid path conceptually (or curl 402) then paid 200
- Call out Blocky402 testnet + ExactHederaScheme

## Minute 2:40–3:40 — Arc Agent Stack

- Terminal: `npm run agent:arc`
- Show Circle wallet on ARC-TESTNET + Gateway pay + `rail=arc-gateway`
- One line: agent holds USDC and pays nanopayment autonomously

## Minute 3:40–4:00 — Close

- Architecture one-liner: Graph evidence → grounded AI → paid delivery (Hedera or Arc)
- Repo URL + “Classic from scratch”

## Do not

- Speed up footage
- Use TTS / AI voiceover
- Claim Graph prize with RPC-only evidence
- Leave `DEV_BYPASS_PAYMENT=true` on-screen for prize payment segments without labeling it as local-only
