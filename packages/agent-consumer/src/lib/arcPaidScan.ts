/**
 * Arc / Circle Agent Stack buyer via `circle services pay`.
 * Shared by CLI agent and web proxy.
 */
import { spawn } from "node:child_process";

export type CircleResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

/** Skip deposit/balance probes for this long after a successful pay or OK balance. */
const GATEWAY_OK_TTL_MS = 20 * 60 * 1000;
let gatewayOkUntil =
  process.env.ARC_ASSUME_GATEWAY_OK === "false" ? 0 : Date.now() + GATEWAY_OK_TTL_MS;

function runCircle(args: string[]): Promise<CircleResult> {
  return new Promise((resolve) => {
    const child = spawn("circle", args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.on("error", (err) =>
      resolve({
        status: 1,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function markGatewayOk(): void {
  gatewayOkUntil = Date.now() + GATEWAY_OK_TTL_MS;
}

function gatewayRecentlyOk(): boolean {
  return Date.now() < gatewayOkUntil;
}

function looksLikeFundingError(text: string): boolean {
  return /insufficient|deposit|balance|underfund|not enough|funding/i.test(
    text,
  );
}

/**
 * Balance/deposit only — no `wallet status` (that alone can cost many seconds).
 */
export async function ensureArcGatewayDeposit(opts?: {
  address?: string;
  chain?: string;
  minUsdc?: number;
}): Promise<void> {
  const address =
    opts?.address?.trim() ||
    process.env.ARC_AGENT_ADDRESS?.trim() ||
    "0x810106009f15ba281d05467bf05adc05a87510ff";
  const chain = opts?.chain?.trim() || process.env.ARC_CHAIN?.trim() || "ARC-TESTNET";
  const min = opts?.minUsdc ?? 0.05;

  const gw = await runCircle([
    "gateway",
    "balance",
    "--address",
    address,
    "--chain",
    chain,
    "--output",
    "json",
  ]);
  if (gw.status !== 0) return;

  const parsed = parseJson(gw.stdout) as { data?: { total?: string } } | null;
  const total = Number(parsed?.data?.total ?? 0);
  if (total >= min) {
    markGatewayOk();
    return;
  }

  const deposit = await runCircle([
    "gateway",
    "deposit",
    "--amount",
    "1",
    "--address",
    address,
    "--chain",
    chain,
    "--method",
    "direct",
    "--output",
    "json",
  ]);
  if (deposit.status !== 0) {
    throw new Error(
      `Gateway deposit failed: ${deposit.stderr || deposit.stdout || "unknown"}`,
    );
  }
  markGatewayOk();
}

function payArgs(opts: {
  api: string;
  agentAddress: string;
  chain: string;
  body: string;
  maxAmount: string;
}): string[] {
  return [
    "services",
    "pay",
    `${opts.api}/audit/arc`,
    "--address",
    opts.agentAddress,
    "--chain",
    opts.chain,
    "-X",
    "POST",
    "--data",
    opts.body,
    "--max-amount",
    opts.maxAmount,
    // Settle + audit; keep headroom but avoid hanging forever.
    "--timeout",
    process.env.ARC_PAY_TIMEOUT_SECONDS?.trim() || "90",
    "--output",
    "json",
  ];
}

export async function arcPaidScan(opts: {
  apiUrl?: string;
  address: string;
  chainId?: number;
  agentAddress?: string;
  chain?: string;
  maxAmount?: string;
}): Promise<{ status: number; body: unknown; raw?: string }> {
  const api = (
    opts.apiUrl ??
    process.env.AUDIT_API_URL ??
    "http://127.0.0.1:8787"
  ).replace(/\/$/, "");
  const agentAddress =
    opts.agentAddress?.trim() ||
    process.env.ARC_AGENT_ADDRESS?.trim() ||
    "0x810106009f15ba281d05467bf05adc05a87510ff";
  const chain =
    opts.chain?.trim() || process.env.ARC_CHAIN?.trim() || "ARC-TESTNET";
  const maxAmount = opts.maxAmount ?? "0.05";
  const body = JSON.stringify({
    chainId: opts.chainId ?? 1,
    address: opts.address,
  });

  const forceEnsure = process.env.ARC_FORCE_GATEWAY_ENSURE === "true";
  // Default: skip slow balance/deposit probes when Gateway was OK recently.
  if (forceEnsure || !gatewayRecentlyOk()) {
    if (process.env.ARC_SKIP_GATEWAY_ENSURE !== "true") {
      await ensureArcGatewayDeposit({ address: agentAddress, chain });
    }
  }

  const args = payArgs({ api, agentAddress, chain, body, maxAmount });
  let pay = await runCircle(args);

  if (
    pay.status !== 0 &&
    looksLikeFundingError(`${pay.stderr}\n${pay.stdout}`)
  ) {
    await ensureArcGatewayDeposit({ address: agentAddress, chain, minUsdc: 0.05 });
    pay = await runCircle(args);
  }

  if (pay.status !== 0) {
    return {
      status: 402,
      body: {
        error: "arc_pay_failed",
        message: pay.stderr || pay.stdout || "circle services pay failed",
      },
      raw: pay.stdout || pay.stderr,
    };
  }

  markGatewayOk();

  const parsed = parseJson(pay.stdout) as {
    data?: { response?: unknown; statusCode?: number };
  } | null;

  const report = parsed?.data?.response;
  if (report) {
    return {
      status: parsed?.data?.statusCode ?? 200,
      body: report,
      raw: pay.stdout,
    };
  }

  return {
    status: 200,
    body: parsed ?? { raw: pay.stdout },
    raw: pay.stdout,
  };
}
