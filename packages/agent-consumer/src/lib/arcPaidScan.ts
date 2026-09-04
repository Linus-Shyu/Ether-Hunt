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

  const status = await runCircle(["wallet", "status", "--output", "json"]);
  if (status.status !== 0) {
    throw new Error(
      `Circle CLI not ready: ${status.stderr || status.stdout || "wallet status failed"}`,
    );
  }

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
  if (total >= min) return;

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

  await ensureArcGatewayDeposit({ address: agentAddress, chain });

  const body = JSON.stringify({
    chainId: opts.chainId ?? 1,
    address: opts.address,
  });

  const pay = await runCircle([
    "services",
    "pay",
    `${api}/audit/arc`,
    "--address",
    agentAddress,
    "--chain",
    chain,
    "-X",
    "POST",
    "--data",
    body,
    "--max-amount",
    opts.maxAmount ?? "0.05",
    "--output",
    "json",
  ]);

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
