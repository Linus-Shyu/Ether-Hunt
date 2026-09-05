import { useEffect, useRef, type FormEvent } from "react";
import type { ChallengeProbe } from "../lib/api";
import type { FlowStep, PayRail } from "../lib/paymentFlow";
import { ChallengeViewer } from "./ChallengeViewer";

export type FlowPhase = "idle" | "running" | "done" | "error";

export const RAILS: { id: PayRail; label: string; hint: string }[] = [
  { id: "hedera", label: "Hedera x402", hint: "Blocky402 · USDC exact scheme" },
  { id: "arc", label: "Arc Agent", hint: "Circle Gateway nanopayment" },
  { id: "local", label: "Local", hint: "Unpaid scan · dev only" },
];

type Props = {
  address: string;
  onAddressChange: (value: string) => void;
  rail: PayRail;
  onRailChange: (rail: PayRail) => void;
  busy: boolean;
  bypassOn: boolean | null;
  targetPulse: boolean;
  steps: FlowStep[];
  activeIdx: number;
  progressPct: number;
  flowPhase: FlowPhase;
  flowNote: string | null;
  logs: string[];
  onSubmit: (event: FormEvent) => void;
  probe: ChallengeProbe | null;
  probing: boolean;
  probeError: string | null;
  onProbe: () => void;
  onProbeDismiss: () => void;
};

function busyLabel(rail: PayRail) {
  if (rail === "hedera") return "Settling Hedera USDC…";
  if (rail === "arc") return "Paying Arc Gateway…";
  return "Hunting…";
}

export function ScanConsole({
  address,
  onAddressChange,
  rail,
  onRailChange,
  busy,
  bypassOn,
  targetPulse,
  steps,
  activeIdx,
  progressPct,
  flowPhase,
  flowNote,
  logs,
  onSubmit,
  probe,
  probing,
  probeError,
  onProbe,
  onProbeDismiss,
}: Props) {
  const huntLabel = rail === "local" ? "Begin hunt" : "Pay & hunt";
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="hero">
      <div className="hero-media" aria-hidden="true">
        <img className="hero-media__img" src="/hero-field.svg" alt="" />
      </div>
      <div className="hero-inner">
        <p className="hero-eyebrow">ETHOnline 2026 · Classic track</p>
        <h1 className="hero-headline">Ether Hunt</h1>
        <p className="hero-subheadline">
          A pay-per-scan allowance auditor. One cent of USDC buys a
          Graph-grounded dossier on any Ethereum address — settled by an agent,
          not a checkout page.
        </p>

        <form className="cta" onSubmit={onSubmit}>
          <div className="rail-tabs" role="radiogroup" aria-label="Payment rail">
            {RAILS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={rail === option.id}
                className={rail === option.id ? "rail-tab active" : "rail-tab"}
                onClick={() => onRailChange(option.id)}
                title={option.hint}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="cta-row">
            <label
              className={targetPulse ? "target hud-frame pulse" : "target hud-frame"}
            >
              <span>Target</span>
              <input
                type="text"
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <button className="hunt" type="submit" disabled={busy}>
              {busy ? busyLabel(rail) : huntLabel}
            </button>
          </div>

          {bypassOn && rail !== "local" ? (
            <p className="cta-note warn">
              DEV_BYPASS_PAYMENT is on — flip it false for a real settle.
            </p>
          ) : (
            <p className="cta-note">
              {RAILS.find((r) => r.id === rail)?.hint} · agent wallet lives on the
              API host
            </p>
          )}

          <ChallengeViewer
            rail={rail}
            probe={probe}
            probing={probing}
            error={probeError}
            onProbe={onProbe}
            onDismiss={onProbeDismiss}
          />

          {flowPhase !== "idle" ? (
            <div
              className={`pay-flow terminal-console ${flowPhase} steps-${steps.length}`}
              role="status"
              aria-live="polite"
            >
              <div className="pay-flow-top">
                <span className="pay-flow-label">
                  {rail === "local" ? "SCAN · CONSOLE" : "PAYMENT · CONSOLE"}
                </span>
                <span className="pay-flow-pct">
                  {flowPhase === "error" ? "FAILED" : `${Math.round(progressPct)}%`}
                </span>
              </div>
              <div className="pay-track" aria-hidden="true">
                <div className="pay-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <ol className="pay-steps">
                {steps.map((step, i) => {
                  const state =
                    flowPhase === "error" && i === activeIdx
                      ? "error"
                      : i < activeIdx || flowPhase === "done"
                        ? "done"
                        : i === activeIdx
                          ? "active"
                          : "todo";
                  return (
                    <li key={step.id} className={`pay-step ${state}`}>
                      <span className="pay-step-dot" />
                      <span className="pay-step-label">{step.label}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="terminal-log" ref={logRef}>
                {logs.map((line, i) => (
                  <p key={`${i}-${line.slice(0, 24)}`}>{line}</p>
                ))}
              </div>
              <p className="pay-flow-note">
                {flowNote ?? steps[activeIdx]?.detail ?? "Waiting for payment flow…"}
              </p>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
