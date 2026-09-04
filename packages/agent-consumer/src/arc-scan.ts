/**
 * Arc Agent Stack consumer CLI — pays POST /audit/arc via Circle Gateway.
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { arcPaidScan } from "./lib/arcPaidScan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const target =
  process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function main() {
  const api = process.env.AUDIT_API_URL ?? "http://127.0.0.1:8787";
  const agent =
    process.env.ARC_AGENT_ADDRESS?.trim() ??
    "0x810106009f15ba281d05467bf05adc05a87510ff";
  const chain = process.env.ARC_CHAIN?.trim() ?? "ARC-TESTNET";

  console.log(`[arc-agent] Circle Agent Stack → ${api}/audit/arc`);
  console.log(`[arc-agent] wallet ${agent} on ${chain}`);
  console.log(`[arc-agent] paying scan for ${target}`);

  const { status, body } = await arcPaidScan({
    apiUrl: api,
    address: target,
    agentAddress: agent,
    chain,
  });

  if (status < 200 || status >= 300) {
    console.error(JSON.stringify(body, null, 2).slice(0, 1200));
    process.exit(1);
  }

  const report = body as {
    findings?: unknown[];
    sources?: { graph?: { live?: boolean }; payment?: { rail?: string } };
    summary?: string;
  };
  console.log(
    `[arc-agent] findings=${report.findings?.length ?? "?"} graphLive=${report.sources?.graph?.live} rail=${report.sources?.payment?.rail}`,
  );
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("[arc-agent] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
