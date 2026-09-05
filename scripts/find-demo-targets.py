#!/usr/bin/env python3
"""
Find demo-worthy scan targets from the live subgraph.

Picks owners that still hold live unlimited USDC allowances granted to spenders
we cannot name, since those are the cases the detector should escalate to high.
Run against the deployed endpoint; prints candidates ranked by unlabelled
exposure so they can be hand-checked before landing in the UI.
"""
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

ENDPOINT = os.environ.get("GRAPH_SUBGRAPH_URL", "").strip()
if not ENDPOINT:
    sys.exit("set GRAPH_SUBGRAPH_URL")

# Mirrors services/audit-api/src/spenders.ts — a labelled contract is an
# expected integration, not an unidentified operator.
LABELLED = {
    "0x000000000022d473030f116ddee9f6b43ac78ba3",
    "0xc36442b4a4522e871399cd717abdd847ab11fe88",
    "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f",
    "0xbd3fa81b58ba92a82136038b25adec7066af3155",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    "0x1111111254eeb25477b68fb85ed929f73a960582",
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
}

UNLIMITED_MIN = 10**38
RPC = os.environ.get("DEMO_RPC_URL", "https://ethereum-rpc.publicnode.com")


def classify_address(address):
    """
    An EOA granting infinite approvals is exposed; a router doing it is design.

    Post-Pectra an EIP-7702 wallet returns a 23-byte `0xef0100||delegate`
    designator from eth_getCode, so a naive "has code" check misreads ordinary
    user wallets as contracts.
    """
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getCode",
            "params": [address, "latest"],
        }
    ).encode()
    req = urllib.request.Request(
        RPC,
        data=body,
        headers={
            "content-type": "application/json",
            "user-agent": "ether-hunt-demo-target-finder/1.0",
        },
    )
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                code = json.load(res).get("result", "0x").lower()
            if len(code) <= 4:
                return "eoa"
            if code.startswith("0xef0100"):
                return "delegated"
            return "contract"
        except Exception as err:
            last = err
    print(f"  ! eth_getCode failed for {address}: {last}", file=sys.stderr)
    return None


def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "content-type": "application/json",
            # Studio's edge rejects the default urllib agent.
            "user-agent": "ether-hunt-demo-target-finder/1.0",
        },
    )
    # Studio drops connections under concurrency; retry rather than lose the run.
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                payload = json.load(res)
            if payload.get("errors"):
                sys.exit(f"graphql error: {payload['errors']}")
            return payload["data"]
        except Exception as err:
            last = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"graph request failed after retries: {last}")


RECENT = """
query Recent($skip: Int!) {
  approvalEvents(
    first: 1000
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
    where: { value_gt: "100000000000000000000000000000000000000" }
  ) { owner spender timestamp }
}
"""

OWNER_HISTORY = """
query OwnerHistory($owner: Bytes!) {
  approvalEvents(
    first: 200
    orderBy: timestamp
    orderDirection: asc
    where: { owner: $owner }
  ) { token spender value timestamp transactionHash }
}
"""


def main():
    candidates = defaultdict(set)
    for page in range(3):
        rows = gql(RECENT, {"skip": page * 1000})["approvalEvents"]
        if not rows:
            break
        for row in rows:
            spender = row["spender"].lower()
            if spender in LABELLED:
                continue
            candidates[row["owner"].lower()].add(spender)

    ordered = [owner for owner, _ in sorted(candidates.items(), key=lambda kv: -len(kv[1]))]
    limit = int(os.environ.get("DEMO_TARGET_LIMIT", "150"))
    # Ranking by spender count surfaces only bots and routers; ordinary wallets
    # approve once or twice, so the tail is where EOAs live.
    mode = os.environ.get("DEMO_TARGET_MODE", "tail")
    if mode == "top":
        ranked = ordered[:limit]
    elif mode == "sample":
        import random

        random.seed(7)
        ranked = random.sample(ordered, min(limit, len(ordered)))
    else:
        ranked = ordered[-limit:]
    print(
        f"{len(candidates)} owners with unlabelled unlimited grants; "
        f"screening {len(ranked)} ({mode})"
    )

    # Contract-ness first: a router granting infinite approvals is design, an
    # EOA doing it is exposure, and only the latter is worth a demo slot.
    with ThreadPoolExecutor(max_workers=12) as pool:
        kinds = list(pool.map(classify_address, ranked))

    by_kind = defaultdict(list)
    for owner, kind in zip(ranked, kinds):
        by_kind[kind].append(owner)
    print(
        "screened: "
        + ", ".join(f"{k}={len(v)}" for k, v in sorted(by_kind.items(), key=lambda kv: str(kv[0])))
    )

    wallet_owners = by_kind["eoa"] + by_kind["delegated"]
    kind_of = dict(zip(ranked, kinds))
    print(f"{len(wallet_owners)} user wallets; pulling allowance history\n")

    def profile(owner):
        history = gql(OWNER_HISTORY, {"owner": owner})["approvalEvents"]
        # Latest write per (token, spender) wins — that is the live allowance.
        live = {}
        for row in history:
            live[(row["token"].lower(), row["spender"].lower())] = row

        unlabelled_live = 0
        labelled_live = 0
        revoked = 0
        for (_, spender), row in live.items():
            value = int(row["value"])
            if value == 0:
                revoked += 1
                continue
            if value < UNLIMITED_MIN:
                continue
            if spender in LABELLED:
                labelled_live += 1
            else:
                unlabelled_live += 1

        return {
            "owner": owner,
            "kind": kind_of.get(owner, "?"),
            "unlabelled_live_unlimited": unlabelled_live,
            "labelled_live_unlimited": labelled_live,
            "revoked_pairs": revoked,
            "pairs": len(live),
            "events": len(history),
        }

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = [r for r in pool.map(profile, wallet_owners) if r["unlabelled_live_unlimited"]]

    results.sort(key=lambda r: (-r["unlabelled_live_unlimited"], -r["revoked_pairs"]))
    print(f"--- USER WALLETS WITH LIVE UNLABELLED UNLIMITED ({len(results)}) ---")
    for r in results:
        print(
            f"{r['owner']}  {r['kind']:9}  unlabelled={r['unlabelled_live_unlimited']:3}  "
            f"labelled={r['labelled_live_unlimited']:2}  revoked={r['revoked_pairs']:2}  "
            f"pairs={r['pairs']:3}  events={r['events']:3}"
        )


if __name__ == "__main__":
    main()
