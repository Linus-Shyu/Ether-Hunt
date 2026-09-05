import { useMemo, useState } from "react";
import type { EvidenceItem } from "@ether-hunt/shared";

const KNOWN: Record<string, string> = {
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0xc36442b4a4522e871399cd717abdd847ab11fe88": "Uni V3 NPM",
  "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f": "Circle TM",
  "0xbd3fa81b58ba92a82136038b25adec7066af3155": "Circle TM",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
};

function short(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function nodeLabel(addr: string) {
  const known = KNOWN[addr.toLowerCase()];
  return known ? known : short(addr);
}

type Edge = {
  id: string;
  owner: string;
  spender: string;
  token: string;
  unlimited: boolean;
  tokenLabel: string;
  role: "owner" | "spender" | "context";
  title: string;
};

function buildEdges(subject: string, evidence: EvidenceItem[]): Edge[] {
  const subjectLc = subject.toLowerCase();
  const edges: Edge[] = [];

  for (const e of evidence) {
    if (e.kind !== "approval") continue;
    const links = e.links;
    if (links?.owner && links?.spender) {
      edges.push({
        id: e.id,
        owner: links.owner,
        spender: links.spender,
        token: links.token ?? "token",
        unlimited: Boolean(links.unlimited),
        tokenLabel: links.tokenLabel ?? "token",
        role: links.role ?? "owner",
        title: e.title,
      });
      continue;
    }

    // Fallback parse from detail: owner=0x… spender=0x…
    const owner = e.detail.match(/owner=(0x[a-fA-F0-9]{4,})/i)?.[1];
    const spender = e.detail.match(/spender=(0x[a-fA-F0-9]{4,})/i)?.[1];
    const token = e.detail.match(/token=(0x[a-fA-F0-9]{4,})/i)?.[1];
    if (!owner || !spender) continue;
    // detail may be shortened — skip if not full addresses
    if (owner.length < 42 || spender.length < 42) continue;
    edges.push({
      id: e.id,
      owner: owner.toLowerCase(),
      spender: spender.toLowerCase(),
      token: (token ?? "token").toLowerCase(),
      unlimited: /unlimited/i.test(e.detail) || /unlimited/i.test(e.title),
      tokenLabel: "USDC",
      role: /network context/i.test(e.title) ? "context" : "owner",
      title: e.title,
    });
  }

  // Prefer subject-related; keep a few context if empty
  const related = edges.filter(
    (ed) => ed.owner === subjectLc || ed.spender === subjectLc,
  );
  const pool = related.length > 0 ? related : edges.filter((ed) => ed.role !== "context");
  // Dedupe by owner-spender-token
  const seen = new Set<string>();
  const unique: Edge[] = [];
  for (const ed of pool) {
    const key = `${ed.owner}|${ed.spender}|${ed.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ed);
    if (unique.length >= 10) break;
  }
  return unique;
}

type Props = {
  address: string;
  evidence: EvidenceItem[];
  onSelect?: (evidenceId: string) => void;
};

export function AllowanceGraph({ address, evidence, onSelect }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  const subject = address.toLowerCase();
  const edges = useMemo(() => buildEdges(subject, evidence), [subject, evidence]);

  const layout = useMemo(() => {
    const W = 760;
    const H = 340;
    const cx = 160;
    const cy = H / 2;
    const spenders = [...new Set(edges.map((e) => e.spender))];
    const ownersExtra = [
      ...new Set(
        edges
          .map((e) => e.owner)
          .filter((o) => o !== subject),
      ),
    ];

    const spenderPos = new Map<string, { x: number; y: number }>();
    const n = Math.max(spenders.length, 1);
    spenders.forEach((s, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = 48 + t * (H - 96);
      spenderPos.set(s, { x: W - 150, y });
    });

    const ownerPos = new Map<string, { x: number; y: number }>();
    ownerPos.set(subject, { x: cx, y: cy });
    ownersExtra.forEach((o, i) => {
      ownerPos.set(o, {
        x: 70,
        y: 56 + i * 52,
      });
    });

    return { W, H, cx, cy, spenderPos, ownerPos, spenders, ownersExtra };
  }, [edges, subject]);

  if (edges.length === 0) {
    return (
      <div className="allow-graph empty">
        <p className="section-label">Allowance graph</p>
        <p className="allow-graph-empty">
          No Graph approval edges in this dossier yet. Try Dense USDC for a
          fuller map.
        </p>
      </div>
    );
  }

  const { W, H, spenderPos, ownerPos } = layout;

  return (
    <div className="allow-graph">
      <header className="allow-graph-head">
        <div>
          <p className="section-label">Allowance graph</p>
          <h3>Who can move what</h3>
        </div>
        <p className="allow-graph-legend">
          <span className="lg unlimited" /> unlimited
          <span className="lg limited" /> limited
          <span className="lg subject" /> subject
        </p>
      </header>

      <svg
        className="allow-graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Token allowance relationship graph"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a6a7c" />
          </marker>
          <marker
            id="arrow-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c24f1d" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const from = ownerPos.get(edge.owner) ?? { x: 120, y: H / 2 };
          const to = spenderPos.get(edge.spender) ?? { x: W - 120, y: H / 2 };
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2 - 8;
          const active = focus === edge.id;
          const dim = focus && focus !== edge.id;
          return (
            <g
              key={edge.id}
              className={
                dim ? "edge dim" : active ? "edge active" : "edge"
              }
              onClick={() => {
                setFocus(edge.id);
                onSelect?.(edge.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <path
                d={`M ${from.x + 54} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 58} ${to.y}`}
                fill="none"
                stroke={edge.unlimited ? "#c24f1d" : "#5a6a7c"}
                strokeWidth={edge.unlimited ? 2.4 : 1.4}
                strokeOpacity={dim ? 0.2 : 0.85}
                markerEnd={
                  edge.unlimited ? "url(#arrow-hot)" : "url(#arrow)"
                }
              />
              <rect
                x={midX - 36}
                y={midY - 10}
                width="72"
                height="18"
                rx="1"
                fill="#eef3f7"
                stroke={edge.unlimited ? "#c24f1d" : "rgba(19,32,51,0.14)"}
                strokeWidth="1"
                opacity={dim ? 0.25 : 1}
              />
              <text
                x={midX}
                y={midY + 3.5}
                textAnchor="middle"
                className="edge-label"
                fill={edge.unlimited ? "#c24f1d" : "#5a6a7c"}
                opacity={dim ? 0.3 : 1}
              >
                {edge.unlimited ? "∞ " : ""}
                {edge.tokenLabel}
              </text>
            </g>
          );
        })}

        {/* subject + other owners */}
        {[...ownerPos.entries()].map(([addr, pos]) => {
          const isSubject = addr === subject;
          return (
            <g key={`o-${addr}`} className="node owner">
              <rect
                x={pos.x - 52}
                y={pos.y - 22}
                width="104"
                height="44"
                rx="2"
                fill={isSubject ? "#132033" : "#f7fafc"}
                stroke={isSubject ? "#132033" : "rgba(19,32,51,0.2)"}
                strokeWidth="1.5"
              />
              <text
                x={pos.x}
                y={pos.y - 2}
                textAnchor="middle"
                className="node-kicker"
                fill={isSubject ? "#e07a45" : "#c24f1d"}
              >
                {isSubject ? "SUBJECT" : "OWNER"}
              </text>
              <text
                x={pos.x}
                y={pos.y + 14}
                textAnchor="middle"
                className="node-label"
                fill={isSubject ? "#f7fafc" : "#132033"}
              >
                {nodeLabel(addr)}
              </text>
            </g>
          );
        })}

        {[...spenderPos.entries()].map(([addr, pos]) => (
          <g key={`s-${addr}`} className="node spender">
            <rect
              x={pos.x - 56}
              y={pos.y - 22}
              width="112"
              height="44"
              rx="2"
              fill="#f7fafc"
              stroke="rgba(19,32,51,0.22)"
              strokeWidth="1.5"
            />
            <text
              x={pos.x}
              y={pos.y - 2}
              textAnchor="middle"
              className="node-kicker"
              fill="#0a6b4d"
            >
              SPENDER
            </text>
            <text
              x={pos.x}
              y={pos.y + 14}
              textAnchor="middle"
              className="node-label"
              fill="#132033"
            >
              {nodeLabel(addr)}
            </text>
          </g>
        ))}
      </svg>

      {focus ? (
        <p className="allow-graph-focus">
          {edges.find((e) => e.id === focus)?.title ?? "Selected edge"} · click
          evidence ledger to inspect
        </p>
      ) : (
        <p className="allow-graph-focus muted">
          Click an edge to focus the matching Graph evidence.
        </p>
      )}
    </div>
  );
}
