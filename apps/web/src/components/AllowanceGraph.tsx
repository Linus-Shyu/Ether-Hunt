/**
 * Cyberpunk allowance / fund-flow terminal for ETHOnline judges.
 * React Flow canvas + d3-force layout + neon risk nodes + particle edges.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  MarkerType,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import type { EvidenceItem } from "@ether-hunt/shared";
import "@xyflow/react/dist/style.css";

/* —— Risk palette (strict brief) —— */
const RISK = {
  high: "#FF0055",
  medium: "#FFB800",
  low: "#00F0FF",
  target: "#00FF88",
  bg: "#0B0F19",
  grid: "rgba(0, 240, 255, 0.08)",
} as const;

type RiskLevel = "high" | "medium" | "low" | "target";

const KNOWN: Record<string, string> = {
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0xc36442b4a4522e871399cd717abdd847ab11fe88": "Uni V3 NPM",
  "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f": "Circle TM",
  "0xbd3fa81b58ba92a82136038b25adec7066af3155": "Circle TM",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uni Router",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uni V2 Router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange",
};

function short(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function nodeLabel(addr: string) {
  return KNOWN[addr.toLowerCase()] ?? short(addr);
}

type FlowEdgeData = {
  evidenceId: string;
  title: string;
  unlimited: boolean;
  tokenLabel: string;
  weight: number;
  role: "owner" | "spender" | "context";
  risk: RiskLevel;
};

type ThreatNodeData = {
  address: string;
  label: string;
  risk: RiskLevel;
  role: "subject" | "owner" | "spender";
  evidenceIds: string[];
  badge: string;
  unlimitedTouches: number;
};

type SimNode = SimulationNodeDatum & { id: string };

type GraphEdge = {
  id: string;
  owner: string;
  spender: string;
  unlimited: boolean;
  tokenLabel: string;
  role: "owner" | "spender" | "context";
  title: string;
};

type GraphMode = "subject" | "network" | "clear";

function buildGraphEdges(
  subject: string,
  evidence: EvidenceItem[],
): { edges: GraphEdge[]; mode: GraphMode } {
  const subjectLc = subject.toLowerCase();
  const edges: GraphEdge[] = [];

  for (const e of evidence) {
    if (e.kind !== "approval") continue;
    const links = e.links;
    if (links?.owner && links?.spender) {
      edges.push({
        id: e.id,
        owner: links.owner,
        spender: links.spender,
        unlimited: Boolean(links.unlimited),
        tokenLabel: links.tokenLabel ?? "token",
        role: links.role ?? "owner",
        title: e.title,
      });
      continue;
    }
    const owner = e.detail.match(/owner=(0x[a-fA-F0-9]{40})/i)?.[1];
    const spender = e.detail.match(/spender=(0x[a-fA-F0-9]{40})/i)?.[1];
    if (!owner || !spender) continue;
    edges.push({
      id: e.id,
      owner: owner.toLowerCase(),
      spender: spender.toLowerCase(),
      unlimited: /unlimited/i.test(e.detail) || /unlimited/i.test(e.title),
      tokenLabel: "USDC",
      role: /network context/i.test(e.title) ? "context" : "owner",
      title: e.title,
    });
  }

  const related = edges.filter(
    (ed) => ed.owner === subjectLc || ed.spender === subjectLc,
  );
  if (related.length > 0) return { edges: dedupe(related, 14), mode: "subject" };
  if (edges.length > 0) return { edges: dedupe(edges, 12), mode: "network" };
  return { edges: [], mode: "clear" };
}

function dedupe(pool: GraphEdge[], limit: number): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const ed of pool) {
    const key = `${ed.owner}|${ed.spender}|${ed.tokenLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ed);
    if (out.length >= limit) break;
  }
  return out;
}

function riskForAddress(
  addr: string,
  subject: string,
  edges: GraphEdge[],
): RiskLevel {
  if (addr === subject) return "target";
  const touches = edges.filter((e) => e.owner === addr || e.spender === addr);
  if (touches.some((t) => t.unlimited)) return "high";
  if (touches.some((t) => t.role === "context")) return "medium";
  if (KNOWN[addr]) return "medium";
  return "low";
}

function badgeFor(risk: RiskLevel, unlimitedTouches: number): string {
  if (risk === "target") return "SCAN TARGET";
  if (risk === "high" || unlimitedTouches > 0)
    return "HIGH RISK — Unlimited Approval";
  if (risk === "medium") return "MEDIUM — Mixer / Unverified";
  return "LOW — EOA / Known Safe Path";
}

/* —— Custom neon node —— */
function ThreatNode({ data, selected }: NodeProps<Node<ThreatNodeData>>) {
  const color = RISK[data.risk];
  const isTarget = data.risk === "target";
  return (
    <div
      className={`tn-node tn-${data.risk}${selected ? " selected" : ""}`}
      style={
        {
          "--tn-color": color,
        } as CSSProperties
      }
    >
      <Handle type="target" position={Position.Left} className="tn-handle" />
      <Handle type="source" position={Position.Right} className="tn-handle" />
      {isTarget ? <span className="tn-ring outer" /> : null}
      {isTarget ? <span className="tn-ring inner" /> : null}
      <span className="tn-core" />
      <div className="tn-copy">
        <span className="tn-role">{data.role.toUpperCase()}</span>
        <span className="tn-label">{data.label}</span>
      </div>
    </div>
  );
}

/* —— Particle bezier edge —— */
function ParticleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
  markerEnd,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const risk = data?.risk ?? "low";
  const color =
    risk === "high"
      ? RISK.high
      : risk === "medium"
        ? RISK.medium
        : risk === "target"
          ? RISK.target
          : RISK.low;
  const weight = data?.weight ?? 1;
  const strokeWidth = 1.2 + weight * 2.2;
  const dimmed = style?.opacity !== undefined && Number(style.opacity) < 0.4;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth,
          strokeOpacity: dimmed ? 0.15 : selected ? 1 : 0.75,
          filter: dimmed
            ? undefined
            : `drop-shadow(0 0 4px ${color})`,
          ...style,
        }}
      />
      {!dimmed ? (
        <circle r={Math.max(2.5, weight * 2.8)} fill={color} className="tn-particle">
          <animateMotion dur={`${1.4 + (1 - weight)}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      ) : null}
      {!dimmed ? (
        <circle r={2} fill="#fff" opacity={0.85} className="tn-particle">
          <animateMotion
            dur={`${1.4 + (1 - weight)}s`}
            begin="0.35s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      ) : null}
      <EdgeLabelRenderer>
        <div
          className={`tn-edge-label${data?.unlimited ? " hot" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            opacity: dimmed ? 0.15 : 1,
          }}
        >
          {data?.unlimited ? "∞ " : ""}
          {data?.tokenLabel ?? "flow"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { threat: ThreatNode };
const edgeTypes = { particle: ParticleEdge };

function runForceLayout(
  nodeIds: string[],
  links: Array<{ source: string; target: string }>,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const nodes: SimNode[] = nodeIds.map((id) => ({ id, x: width / 2, y: height / 2 }));
  const sim = forceSimulation(nodes)
    .force(
      "link",
      forceLink(links)
        .id((d) => (d as SimNode).id)
        .distance(160)
        .strength(0.55),
    )
    .force("charge", forceManyBody().strength(-520))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(56))
    .stop();

  for (let i = 0; i < 220; i++) sim.tick();

  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    pos.set(n.id, {
      x: (n.x ?? width / 2) - 70,
      y: (n.y ?? height / 2) - 28,
    });
  }
  return pos;
}

type TooltipState = {
  x: number;
  y: number;
  data: ThreatNodeData;
} | null;

type Props = {
  address: string;
  evidence: EvidenceItem[];
  onSelect?: (evidenceId: string) => void;
};

function ThreatFlowInner({ address, evidence, onSelect }: Props) {
  const subject = address.toLowerCase();
  const { edges: rawEdges, mode } = useMemo(
    () => buildGraphEdges(subject, evidence),
    [subject, evidence],
  );
  const [highOnly, setHighOnly] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { fitView, setCenter } = useReactFlow();

  const filteredEdges = useMemo(
    () => (highOnly ? rawEdges.filter((e) => e.unlimited) : rawEdges),
    [rawEdges, highOnly],
  );

  const graph = useMemo(() => {
    if (filteredEdges.length === 0) {
      return { nodes: [] as Node<ThreatNodeData>[], edges: [] as Edge<FlowEdgeData>[] };
    }

    const addrSet = new Set<string>();
    for (const e of filteredEdges) {
      addrSet.add(e.owner);
      addrSet.add(e.spender);
    }
    if (mode === "network" || mode === "subject") addrSet.add(subject);

    const ids = [...addrSet];
    const linkSpec = filteredEdges.map((e) => ({
      source: e.owner,
      target: e.spender,
    }));
    const positions = runForceLayout(ids, linkSpec, 920, 520);

    const evidenceByAddr = new Map<string, string[]>();
    const unlimitedByAddr = new Map<string, number>();
    for (const e of filteredEdges) {
      for (const a of [e.owner, e.spender]) {
        const list = evidenceByAddr.get(a) ?? [];
        list.push(e.id);
        evidenceByAddr.set(a, list);
        if (e.unlimited) {
          unlimitedByAddr.set(a, (unlimitedByAddr.get(a) ?? 0) + 1);
        }
      }
    }

    const nodes: Node<ThreatNodeData>[] = ids.map((id) => {
      const risk = riskForAddress(id, subject, filteredEdges);
      const unlimitedTouches = unlimitedByAddr.get(id) ?? 0;
      const role: ThreatNodeData["role"] =
        id === subject ? "subject" : filteredEdges.some((e) => e.spender === id) ? "spender" : "owner";
      const p = positions.get(id) ?? { x: 400, y: 240 };
      return {
        id,
        type: "threat",
        position: p,
        data: {
          address: id,
          label: nodeLabel(id),
          risk,
          role,
          evidenceIds: evidenceByAddr.get(id) ?? [],
          badge: badgeFor(risk, unlimitedTouches),
          unlimitedTouches,
        },
        draggable: true,
      };
    });

    const edges: Edge<FlowEdgeData>[] = filteredEdges.map((e) => {
      const risk: RiskLevel = e.unlimited
        ? "high"
        : e.role === "context"
          ? "medium"
          : "low";
      const weight = e.unlimited ? 1 : 0.45;
      return {
        id: e.id,
        source: e.owner,
        target: e.spender,
        type: "particle",
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color:
            risk === "high"
              ? RISK.high
              : risk === "medium"
                ? RISK.medium
                : RISK.low,
          width: 16,
          height: 16,
        },
        data: {
          evidenceId: e.id,
          title: e.title,
          unlimited: e.unlimited,
          tokenLabel: e.tokenLabel,
          weight,
          role: e.role,
          risk,
        },
      };
    });

    return { nodes, edges };
  }, [filteredEdges, mode, subject]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const t = window.setTimeout(() => fitView({ padding: 0.18, duration: 450 }), 40);
    return () => window.clearTimeout(t);
  }, [graph, setNodes, setEdges, fitView]);

  const neighborIds = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const e of edges) {
      if (e.source === hoverId || e.target === hoverId) {
        set.add(e.source);
        set.add(e.target);
      }
    }
    return set;
  }, [hoverId, edges]);

  const displayNodes = useMemo(() => {
    if (!neighborIds) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: neighborIds.has(n.id) ? 1 : 0.18,
        filter: neighborIds.has(n.id) ? undefined : "blur(1.5px)",
        transition: "opacity 180ms ease, filter 180ms ease",
        willChange: "opacity, filter",
      },
    }));
  }, [nodes, neighborIds]);

  const displayEdges = useMemo(() => {
    if (!neighborIds) return edges;
    return edges.map((e) => {
      const hot = neighborIds.has(e.source) && neighborIds.has(e.target);
      return {
        ...e,
        style: {
          ...e.style,
          opacity: hot ? 1 : 0.12,
          transition: "opacity 180ms ease",
          willChange: "opacity",
        },
      };
    });
  }, [edges, neighborIds]);

  const onNodeMouseEnter = useCallback(
    (event: ReactMouseEvent, node: Node<ThreatNodeData>) => {
      setHoverId(node.id);
      const rect = wrapRef.current?.getBoundingClientRect();
      setTooltip({
        x: event.clientX - (rect?.left ?? 0) + 14,
        y: event.clientY - (rect?.top ?? 0) + 14,
        data: node.data,
      });
    },
    [],
  );

  const onNodeMouseMove = useCallback(
    (event: ReactMouseEvent, node: Node<ThreatNodeData>) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      setTooltip({
        x: event.clientX - (rect?.left ?? 0) + 14,
        y: event.clientY - (rect?.top ?? 0) + 14,
        data: node.data,
      });
    },
    [],
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoverId(null);
    setTooltip(null);
  }, []);

  const onNodeClick = useCallback(
    (_: ReactMouseEvent, node: Node<ThreatNodeData>) => {
      const id = node.data.evidenceIds[0];
      if (id) onSelect?.(id);
    },
    [onSelect],
  );

  const onEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: Edge<FlowEdgeData>) => {
      const id = edge.data?.evidenceId ?? edge.id;
      onSelect?.(id);
    },
    [onSelect],
  );

  const recenter = useCallback(() => {
    fitView({ padding: 0.18, duration: 500 });
    const subjectNode = nodes.find((n) => n.id === subject);
    if (subjectNode) {
      setCenter(
        subjectNode.position.x + 70,
        subjectNode.position.y + 28,
        { zoom: 1.05, duration: 500 },
      );
    }
  }, [fitView, setCenter, nodes, subject]);

  if (mode === "clear" || filteredEdges.length === 0) {
    return (
      <div className="threat-terminal clear">
        <header className="threat-terminal-head">
          <div>
            <p className="section-label">Threat terminal</p>
            <h3>
              {highOnly && rawEdges.length > 0
                ? "No ∞ edges in filter"
                : "No USDC approval edges for this subject"}
            </h3>
          </div>
          {rawEdges.length > 0 ? (
            <button
              type="button"
              className="threat-btn"
              onClick={() => setHighOnly(false)}
            >
              Show all risks
            </button>
          ) : null}
        </header>
        <div className="threat-empty-radar" aria-hidden="true">
          <span className="threat-sweep" />
          <span className="threat-empty-label">{nodeLabel(subject)}</span>
        </div>
        <p className="threat-empty-copy">
          Subgraph indexes recent mainnet USDC Approvals. Use{" "}
          <strong>Dense USDC</strong> for a full subject constellation.
        </p>
      </div>
    );
  }

  const unlimitedCount = filteredEdges.filter((e) => e.unlimited).length;

  return (
    <div className="threat-terminal" ref={wrapRef}>
      <header className="threat-terminal-head">
        <div>
          <p className="section-label">Threat terminal</p>
          <h3>
            {mode === "subject"
              ? "On-chain risk & fund-flow map"
              : "Network risk sample"}
          </h3>
        </div>
        <div className="threat-terminal-meta">
          <span className="threat-stat">
            <strong>{filteredEdges.length}</strong> flows
          </span>
          <span className="threat-stat hot">
            <strong>{unlimitedCount}</strong> ∞ risk
          </span>
        </div>
      </header>

      {mode === "network" ? (
        <p className="threat-banner">
          Subject has no indexed USDC approvals — showing live Graph network
          unlimited samples (not this wallet’s edges).
        </p>
      ) : null}

      <div className="threat-toolbar">
        <button type="button" className="threat-btn" onClick={recenter}>
          Recenter
        </button>
        <button
          type="button"
          className={highOnly ? "threat-btn active" : "threat-btn"}
          onClick={() => setHighOnly((v) => !v)}
        >
          {highOnly ? "High risk only · ON" : "Filter high risk only"}
        </button>
        <div className="threat-legend">
          <span>
            <i style={{ background: RISK.target }} /> Target
          </span>
          <span>
            <i style={{ background: RISK.high }} /> High
          </span>
          <span>
            <i style={{ background: RISK.medium }} /> Medium
          </span>
          <span>
            <i style={{ background: RISK.low }} /> Low
          </span>
        </div>
      </div>

      <div className="threat-canvas">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseMove={onNodeMouseMove}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          fitView
          minZoom={0.35}
          maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
        >
          <Background
            id="grid"
            variant={BackgroundVariant.Lines}
            gap={28}
            color={RISK.grid}
            lineWidth={0.6}
          />
          <Background
            id="dots"
            variant={BackgroundVariant.Dots}
            gap={14}
            size={1}
            color="rgba(0,255,136,0.12)"
          />
          <Controls showInteractive={false} className="threat-controls" />
          <MiniMap
            className="threat-minimap"
            maskColor="rgba(5,5,10,0.75)"
            nodeColor={(n) => {
              const r = (n.data as ThreatNodeData | undefined)?.risk ?? "low";
              return RISK[r];
            }}
          />
        </ReactFlow>

        {tooltip ? (
          <div
            className="threat-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="threat-tooltip-addr">
              {short(tooltip.data.address)}
              {KNOWN[tooltip.data.address] ? (
                <span> · {KNOWN[tooltip.data.address]}</span>
              ) : null}
            </div>
            <div
              className={`threat-tooltip-badge risk-${tooltip.data.risk}`}
            >
              {tooltip.data.badge}
            </div>
            <div className="threat-tooltip-ev">
              {tooltip.data.evidenceIds[0]
                ? `Evidence · ${tooltip.data.evidenceIds[0].slice(0, 18)}`
                : "No linked evidence id"}
            </div>
          </div>
        ) : null}
      </div>

      <p className="threat-hint">
        Scroll to zoom · drag canvas to pan · hover nodes for risk glass · click
        edge/node to sync Graph evidence.
      </p>
    </div>
  );
}

export function AllowanceGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <ThreatFlowInner {...props} />
    </ReactFlowProvider>
  );
}
