import type { AuditReport } from "@ether-hunt/shared";

export const API = "/api";

export type Health = {
  ok: boolean;
  service: string;
  partners: string[];
  x402: {
    bypass: boolean;
    payTo: boolean;
    network: string;
    hederaScheme: boolean;
    hederaBuyer: boolean;
    arcGateway: boolean;
    arcPayTo?: string;
  };
  ai: { configured: boolean; provider: string };
};

/** One `accepts[]` entry of an x402 payment challenge. */
export type ChallengeAccept = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

export type Challenge = {
  x402Version: number;
  error?: string;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: ChallengeAccept[];
};

export type ChallengeProbe = {
  status: number;
  gated: boolean;
  challenge?: Challenge;
  raw?: string;
  note: string;
};

export async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`${API}/health`);
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export async function warmEvidence(address: string): Promise<void> {
  await fetch(`${API}/scan/warm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: 1, address }),
  }).catch(() => undefined);
}

export async function runScan(
  path: string,
  address: string,
): Promise<AuditReport> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: 1, address }),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(
      payload.message ?? payload.error ?? `HTTP ${res.status}`,
    );
  }
  return payload as AuditReport;
}

function decodeChallengeHeader(value: string): Challenge | undefined {
  try {
    const json = atob(value);
    return JSON.parse(json) as Challenge;
  } catch {
    return undefined;
  }
}

/**
 * Calls the gated endpoint WITHOUT paying so the raw HTTP 402 challenge is
 * visible in the UI. x402 ships the challenge base64-encoded in the
 * `payment-required` response header.
 */
export async function probeChallenge(
  gatedPath: string,
  address: string,
): Promise<ChallengeProbe> {
  const res = await fetch(gatedPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: 1, address }),
  });

  if (res.status !== 402) {
    return {
      status: res.status,
      gated: false,
      note:
        res.status === 200
          ? "Endpoint answered 200 without payment — DEV_BYPASS_PAYMENT is on."
          : `Unexpected HTTP ${res.status} from gated endpoint.`,
    };
  }

  const header = res.headers.get("payment-required");
  const challenge = header ? decodeChallengeHeader(header) : undefined;

  return {
    status: 402,
    gated: true,
    challenge,
    raw: challenge ? JSON.stringify(challenge, null, 2) : (header ?? undefined),
    note: challenge
      ? "Gate verified — unpaid request rejected with a signed payment challenge."
      : "402 received, but the challenge header could not be decoded.",
  };
}

/** USDC-style minor units → human amount. */
export function formatAmount(amount: string, decimals = 6): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `$${(n / 10 ** decimals).toFixed(Math.min(4, decimals))}`;
}

/** Arc quotes a 30-day validity window; raw seconds read as noise. */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—";
  if (seconds < 120) return `${seconds}s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}
