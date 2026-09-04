/**
 * Arc-seat consumer agent (scaffold).
 *
 * Calls the Ether Hunt audit API the way an autonomous agent would:
 * 1) request without payment → expect 402
 * 2) retry with payment proof OR local bypass
 *
 * Live Hedera signing belongs in `@x402/hedera` + Circle Agent Stack wallets.
 * `@x402/hedera` currently fails npm install (`@hiero-ledger/proto@2.31.0` missing),
 * so this agent uses DEV bypass unless PAYMENT_HEADER is provided.
 *
 * Later: replace bypass with Circle Agent Stack wallet + USDC on Arc / Hedera x402.
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const API = process.env.AUDIT_API_URL ?? "http://127.0.0.1:8787";
const address =
  process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function main() {
  console.log(`[agent] probing ${API}/audit for ${address}`);

  const first = await fetch(`${API}/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: 1, address }),
  });

  console.log(`[agent] first status ${first.status}`);
  const firstBody = await first.json();
  console.log(JSON.stringify(firstBody, null, 2).slice(0, 800));

  if (first.status === 402) {
    const paymentHeader = process.env.PAYMENT_HEADER?.trim();
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (paymentHeader) {
      headers["PAYMENT-SIGNATURE"] = paymentHeader;
      console.log("[agent] retrying with PAYMENT-SIGNATURE from env");
    } else if (process.env.ALLOW_AGENT_DEV_BYPASS === "true") {
      headers["x-ether-hunt-dev-bypass"] = "1";
      console.log("[agent] retrying with DEV bypass (not prize-valid)");
    } else {
      console.log(
        "[agent] stop: set PAYMENT_HEADER (from x402 PoC signer) or ALLOW_AGENT_DEV_BYPASS=true",
      );
      process.exit(2);
    }

    const second = await fetch(`${API}/audit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ chainId: 1, address }),
    });
    console.log(`[agent] paid/bypass status ${second.status}`);
    const report = await second.json();
    console.log(
      `[agent] findings=${report.findings?.length ?? 0} graphLive=${report.sources?.graph?.live}`,
    );
    console.log(JSON.stringify(report.summary, null, 2));
    return;
  }

  if (first.ok) {
    console.log("[agent] server allowed unpaid audit (DEV_BYPASS_PAYMENT likely true)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
