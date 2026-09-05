import { randomUUID } from "node:crypto";
import type { EvidenceItem, Finding, Severity } from "@ether-hunt/shared";
import { fetchJson } from "./http.js";

export interface AiSynthesis {
  enabled: boolean;
  model?: string;
  narrative: string;
  findings: Finding[];
  note: string;
}

const SEVERITIES: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

function asSeverity(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity)
    ? (value as Severity)
    : "info";
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json_object");
  return JSON.parse(text.slice(start, end + 1));
}

function localGroundedNarrative(input: {
  address: string;
  evidence: EvidenceItem[];
  ruleFindings: Finding[];
}): AiSynthesis {
  const approvals = input.evidence.filter((e) => e.kind === "approval");
  const unlimited = input.ruleFindings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  );
  const permit = input.ruleFindings.find((f) => /permit2/i.test(f.title));
  const ids = approvals.slice(0, 3).map((e) => e.id);
  const narrative = [
    `Address ${input.address} was analyzed against live Graph ApprovalEvent evidence (${approvals.length} approval rows).`,
    unlimited.length
      ? `Detectors flagged ${unlimited.length} high-severity unlimited allowance path(s); see [${ids[0] ?? "evidence"}].`
      : `No unlimited-allowance high findings in the current window.`,
    permit
      ? `Permit2 exposure is present (${permit.title}).`
      : `No Permit2 finding in the rule layer.`,
    `All statements above are constrained to cited evidence IDs — no off-evidence claims.`,
  ].join(" ");

  const findings: Finding[] = [];
  if (unlimited.length && ids[0]) {
    findings.push({
      id: randomUUID(),
      title: "[AI] Graph-grounded allowance risk briefing",
      severity: "medium",
      confidence: 0.72,
      summary: narrative,
      recommendation:
        "Prioritize revoking unused unlimited spenders called out in high findings, starting with bridge/Permit2 routers.",
      evidenceIds: ids,
    });
  }

  return {
    enabled: true,
    model: "local-grounded-analyst",
    narrative,
    findings,
    note: "Local Graph-grounded analyst (LLM API token invalid/unavailable). Still cite-only.",
  };
}

/**
 * Graph-grounded LLM pass for The Graph AI prize narrative.
 * Supports Anthropic Messages API OR OpenAI-compatible chat/completions
 * (when ANTHROPIC_BASE_URL points at a .../chat/completions proxy).
 */
export async function synthesizeWithAi(input: {
  address: string;
  evidence: EvidenceItem[];
  ruleFindings: Finding[];
  graphLive: boolean;
}): Promise<AiSynthesis> {
  const apiKey =
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim();
  const deepseekBase =
    process.env.DEEPSEEK_BASE_URL?.trim() ||
    "https://api.deepseek.com/v1/chat/completions";
  const configuredBase =
    process.env.DEEPSEEK_API_KEY?.trim()
      ? deepseekBase
      : process.env.ANTHROPIC_BASE_URL?.trim() ||
        process.env.OPENAI_BASE_URL?.trim();
  const model =
    process.env.DEEPSEEK_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    (process.env.DEEPSEEK_API_KEY?.trim() ? "deepseek-chat" : "claude-sonnet-4-20250514");

  if (!apiKey) {
    if (input.graphLive) return localGroundedNarrative(input);
    return {
      enabled: false,
      narrative:
        "LLM synthesis skipped (no API key) and Graph was not live.",
      findings: [],
      note: "Set a valid LLM API key for stronger Graph AI prize narrative.",
    };
  }

  if (!input.graphLive) {
    return {
      enabled: false,
      narrative:
        "LLM synthesis skipped because Graph was not live — refuse to invent on-chain claims.",
      findings: [],
      note: "AI requires live Graph evidence for prize-valid grounding.",
    };
  }

  const evidenceIds = new Set(input.evidence.map((e) => e.id));
  const compactEvidence = input.evidence.slice(0, 20).map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    ref: e.ref,
    occurredAt: e.occurredAt,
  }));
  const compactRules = input.ruleFindings.slice(0, 12).map((f) => ({
    title: f.title,
    severity: f.severity,
    summary: f.summary,
    evidenceIds: f.evidenceIds,
  }));

  const system = `You are Ether Hunt's on-chain audit analyst.
Rules:
- ONLY reason from the provided Graph/RPC evidence and rule findings.
- Every finding MUST include evidenceIds that exist in the evidence list.
- Do NOT invent transactions, balances, or approvals.
- Prefer concrete spender risk (Permit2, bridges, routers) over generic advice.
- Return STRICT JSON only (no markdown).`;

  const user = JSON.stringify({
    task: "Produce an audit narrative and up to 4 additional AI findings.",
    address: input.address,
    evidence: compactEvidence,
    ruleFindings: compactRules,
    outputSchema: {
      narrative: "string, 2-4 sentences, cite evidence ids in prose like [id]",
      findings: [
        {
          title: "string",
          severity: "critical|high|medium|low|info",
          confidence: "0-1 number",
          summary: "string",
          recommendation: "string",
          evidenceIds: ["evidence id strings"],
        },
      ],
    },
  });

  const openAiStyle =
    Boolean(process.env.DEEPSEEK_API_KEY?.trim()) ||
    Boolean(configuredBase?.includes("/chat/completions")) ||
    Boolean(process.env.OPENAI_API_KEY?.trim());

  let text = "";
  let notePrefix = "";

  if (openAiStyle) {
    const url = configuredBase?.includes("/chat/completions")
      ? configuredBase!
      : `${(configuredBase || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
    const response = await fetchJson(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      timeoutMs: 8_000,
      retries: 0,
    });
    if (!response.ok || response.error) {
      // Proxy tokens go stale often — keep a cite-only local analyst so Graph AI path still demos.
      const local = localGroundedNarrative(input);
      return {
        ...local,
        note: `LLM HTTP failed (${response.error ?? response.status}); ${local.note}`,
      };
    }
    const body = response.json as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (body.error?.message) {
      const local = localGroundedNarrative(input);
      return {
        ...local,
        note: `LLM error (${body.error.message}); ${local.note}`,
      };
    }
    text = body.choices?.[0]?.message?.content ?? "";
    notePrefix = `OpenAI-compatible ${model}`;
  } else {
    const base = (configuredBase || "https://api.anthropic.com").replace(
      /\/$/,
      "",
    );
    const response = await fetchJson(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
      timeoutMs: 8_000,
      retries: 0,
    });
    if (!response.ok || response.error) {
      const local = localGroundedNarrative(input);
      return {
        ...local,
        note: `Anthropic HTTP failed (${response.error ?? response.status}); ${local.note}`,
      };
    }
    const body = response.json as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    };
    if (body.error?.message) {
      const local = localGroundedNarrative(input);
      return {
        ...local,
        note: `Anthropic error (${body.error.message}); ${local.note}`,
      };
    }
    text = body.content?.map((c) => c.text ?? "").join("\n") ?? "";
    notePrefix = `Anthropic ${model}`;
  }

  try {
    const parsed = extractJsonObject(text) as {
      narrative?: string;
      findings?: Array<{
        title?: string;
        severity?: string;
        confidence?: number;
        summary?: string;
        recommendation?: string;
        evidenceIds?: string[];
      }>;
    };

    const findings: Finding[] = [];
    for (const raw of parsed.findings ?? []) {
      const ids = (raw.evidenceIds ?? []).filter((id) => evidenceIds.has(id));
      if (!raw.title || ids.length === 0) continue;
      findings.push({
        id: randomUUID(),
        title: `[AI] ${raw.title}`,
        severity: asSeverity(raw.severity),
        confidence: Math.min(
          0.95,
          Math.max(0.4, Number(raw.confidence ?? 0.7)),
        ),
        summary: raw.summary ?? "",
        recommendation: raw.recommendation ?? "Review cited Graph evidence.",
        evidenceIds: ids,
      });
    }

    return {
      enabled: true,
      model,
      narrative:
        parsed.narrative?.trim() ||
        "AI synthesis completed with cited Graph evidence.",
      findings: findings.slice(0, 4),
      note: `${notePrefix} grounded on ${compactEvidence.length} evidence rows.`,
    };
  } catch (error) {
    const local = localGroundedNarrative(input);
    return {
      ...local,
      note: `LLM JSON parse failed (${error instanceof Error ? error.message : "parse_error"}); ${local.note}`,
    };
  }
}
