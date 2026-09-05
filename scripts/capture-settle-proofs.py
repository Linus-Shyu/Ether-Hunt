#!/usr/bin/env python3
"""Capture Arc settlement proof + verify Hedera mirror tx for README."""
from __future__ import annotations

import json
import os
import re
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CTX = ssl.create_default_context()


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    for line in (ROOT / ".env").read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def rpc(method: str, params: list, retries: int = 5):
    last: Exception | None = None
    for i in range(retries):
        try:
            req = urllib.request.Request(
                "https://rpc.testnet.arc.network",
                data=json.dumps(
                    {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
                ).encode(),
                headers={"content-type": "application/json", "user-agent": "ether-hunt"},
            )
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.2 * (i + 1))
    assert last is not None
    raise last


def main() -> None:
    env = load_env()
    agent = env["ARC_AGENT_ADDRESS"]
    service = env["ARC_SERVICE_ADDRESS"]
    chain = env.get("ARC_CHAIN", "ARC-TESTNET")
    body = json.dumps(
        {
            "chainId": 1,
            "address": "0x0218033bc4c88e91a6cc9a6aceee421dda39448d",
        }
    )

    cmd = [
        "circle",
        "services",
        "pay",
        "http://127.0.0.1:8787/audit/arc",
        "--address",
        agent,
        "--chain",
        chain,
        "-X",
        "POST",
        "--data",
        body,
        "--max-amount",
        "0.05",
        "--timeout",
        "90",
        "--output",
        "json",
    ]
    print("running:", " ".join(cmd[:6]), "...")
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    Path("/tmp/eh-circle-pay.json").write_text(proc.stdout)
    Path("/tmp/eh-circle-err.txt").write_text(proc.stderr)
    print("circle status", proc.returncode, "stdout", len(proc.stdout))

    urls = re.findall(r"https?://[^\s\"']+", proc.stdout + proc.stderr)
    hashes = re.findall(r"0x[a-fA-F0-9]{64}", proc.stdout + proc.stderr)
    print("urls", urls)
    print("hashes", hashes)

    try:
        data = json.loads(proc.stdout)

        def walk(o, path=""):
            if isinstance(o, dict):
                for k, v in o.items():
                    p = f"{path}.{k}" if path else k
                    if any(
                        x in k.lower()
                        for x in (
                            "tx",
                            "hash",
                            "explorer",
                            "receipt",
                            "payment",
                            "settle",
                            "transaction",
                        )
                    ):
                        print("KEY", p, "=", json.dumps(v)[:240] if not isinstance(v, (dict, list)) else type(v).__name__)
                    walk(v, p)
            elif isinstance(o, list):
                for i, v in enumerate(o[:30]):
                    walk(v, f"{path}[{i}]")

        walk(data)
    except Exception as e:  # noqa: BLE001
        print("json parse failed", e)
        print(proc.stdout[:800])
        print(proc.stderr[:800])

    # Arc Transfer logs to service
    usdc = "0x3600000000000000000000000000000000000000"
    topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    bn = int(rpc("eth_blockNumber", [])["result"], 16)
    print("arc block", bn)
    from_block = hex(max(0, bn - 150000))
    to_topic = "0x" + service[2:].lower().zfill(64)
    from_topic = "0x" + agent[2:].lower().zfill(64)
    for label, topics in (
        ("to_service", [topic, None, to_topic]),
        ("from_agent", [topic, from_topic]),
    ):
        res = rpc(
            "eth_getLogs",
            [
                {
                    "fromBlock": from_block,
                    "toBlock": "latest",
                    "address": usdc,
                    "topics": topics,
                }
            ],
        )
        if res.get("error"):
            print(label, "ERR", res["error"])
            continue
        arr = res.get("result") or []
        print(label, "count", len(arr))
        for lg in arr[-12:]:
            print(
                " ",
                lg["transactionHash"],
                "block",
                int(lg["blockNumber"], 16),
                "data",
                lg["data"],
            )


if __name__ == "__main__":
    main()
