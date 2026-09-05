import type { Health } from "../lib/api";

const PARTNERS = [
  { key: "hedera", label: "Hedera x402" },
  { key: "graph", label: "The Graph" },
  { key: "arc", label: "Arc Agent" },
] as const;

export function TerminalHeader({ health }: { health: Health | null }) {
  function state(key: (typeof PARTNERS)[number]["key"]) {
    if (!health) return "idle";
    if (key === "hedera")
      return health.x402.payTo && health.x402.hederaScheme ? "on" : "off";
    if (key === "arc") return health.x402.arcGateway ? "on" : "off";
    return "on";
  }

  return (
    <header className="terminal-header" role="banner">
      <div className="terminal-bar">
        <div className="terminal-controls" aria-hidden="true">
          <span className="control close" />
          <span className="control minimize" />
          <span className="control maximize" />
        </div>
        <div className="terminal-title">ether-hunt — ETHOnline 2026</div>
        <div className="terminal-actions">
          {PARTNERS.map((p) => (
            <span key={p.key} className={`partner-chip ${state(p.key)}`}>
              <i aria-hidden="true" />
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
