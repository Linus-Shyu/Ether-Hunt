import { setDefaultResultOrder } from "node:dns";

// Prefer IPv4 — intermittent "fetch failed" on some networks when AAAA is broken.
try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* older Node */
}

export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<{ ok: boolean; status: number; json: unknown; error?: string }> {
  const timeoutMs = init.timeoutMs ?? 20_000;
  const retries = init.retries ?? 2;
  const { timeoutMs: _t, retries: _r, ...rest } = init;

  let lastError = "fetch failed";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...rest,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 500) };
      }
      return { ok: response.ok, status: response.status, json };
    } catch (error) {
      const err = error as Error & { cause?: { code?: string; message?: string } };
      lastError = [
        err.message,
        err.cause?.code,
        err.cause?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return { ok: false, status: 0, json: null, error: lastError };
}
