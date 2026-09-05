import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AuditReport } from "@ether-hunt/shared";
import { CaseFiles, CASE_FILES } from "./components/CaseFiles";
import { Dossier } from "./components/Dossier";
import { ProofRail } from "./components/ProofRail";
import { ScanConsole, type FlowPhase } from "./components/ScanConsole";
import { TerminalHeader } from "./components/TerminalHeader";
import {
  getHealth,
  probeChallenge,
  runScan,
  warmEvidence,
  type ChallengeProbe,
  type Health,
} from "./lib/api";
import {
  flowStepsFor,
  gatedProbePath,
  paidScanPath,
  stepIndex,
  type FlowStepId,
  type PayRail,
} from "./lib/paymentFlow";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function App() {
  const [address, setAddress] = useState(CASE_FILES[0].value);
  const [rail, setRail] = useState<PayRail>("hedera");
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeStep, setActiveStep] = useState<FlowStepId>("request");
  const [flowNote, setFlowNote] = useState<string | null>(null);
  const [focusEvidenceId, setFocusEvidenceId] = useState<string | null>(null);
  const [flashEvidenceId, setFlashEvidenceId] = useState<string | null>(null);
  const [targetPulse, setTargetPulse] = useState(false);
  const [probe, setProbe] = useState<ChallengeProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const bypassOn = health ? health.x402.bypass : null;
  const steps = useMemo(() => flowStepsFor(rail), [rail]);
  const activeIdx = stepIndex(steps, activeStep);
  const progressPct =
    flowPhase === "idle"
      ? 0
      : flowPhase === "done"
        ? 100
        : Math.min(96, ((activeIdx + 0.45) / steps.length) * 100);

  const logs = useMemo(() => {
    if (flowPhase === "idle") return [] as string[];
    const lines: string[] = ["[SYS] Tactical uplink online · Ether Hunt"];
    for (let i = 0; i <= activeIdx && i < steps.length; i++) {
      const step = steps[i];
      const tag =
        step.id === "challenge"
          ? "[x402]"
          : step.id === "settle"
            ? rail === "hedera"
              ? "[HEDERA]"
              : rail === "arc"
                ? "[ARC]"
                : "[PAY]"
            : step.id === "scan"
              ? "[GRAPH]"
              : step.id === "ready"
                ? "[OK]"
                : "[SYS]";
      const prefix = i < activeIdx || flowPhase === "done" ? "✓" : "›";
      lines.push(`${prefix} ${tag} ${step.detail}`);
    }
    if (flowNote) lines.push(`[LIVE] ${flowNote}`);
    if (flowPhase === "error") lines.push("[ERR] Pipeline aborted — see status");
    if (flowPhase === "done") lines.push("[OK] Dossier sealed · scroll to review");
    return lines.slice(-8);
  }, [flowPhase, activeIdx, steps, flowNote, rail]);

  useEffect(() => {
    let cancelled = false;
    void getHealth().then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFlowPhase("idle");
    setActiveStep("request");
    setFlowNote(null);
    setProbe(null);
    setProbeError(null);
  }, [rail]);

  // Prefetch Graph as soon as the target looks valid — overlaps with the user
  // still reading the page, so the paid scan does not pay for cold indexing.
  useEffect(() => {
    if (!ADDRESS_RE.test(address.trim())) return;
    const handle = window.setTimeout(() => {
      void warmEvidence(address.trim());
    }, 200);
    return () => window.clearTimeout(handle);
  }, [address]);

  function selectCaseAddress(value: string) {
    setAddress(value);
    setTargetPulse(true);
    window.setTimeout(() => setTargetPulse(false), 1200);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusEvidence(id: string) {
    setFocusEvidenceId(id);
    setFlashEvidenceId(id);
    window.setTimeout(() => setFlashEvidenceId(null), 1400);
    requestAnimationFrame(() => {
      const finding = report?.findings.find((f) => f.evidenceIds.includes(id));
      const target = finding
        ? document.getElementById(`finding-${finding.id}`)
        : document.getElementById(`evidence-${id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function onProbe() {
    if (rail === "local") return;
    setProbing(true);
    setProbeError(null);
    try {
      setProbe(await probeChallenge(gatedProbePath(rail), address.trim()));
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  }

  async function onScan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReport(null);
    setFlowPhase("running");
    setFlowNote(null);
    setActiveStep("request");
    setFocusEvidenceId(null);

    try {
      if (rail === "local") {
        setActiveStep("scan");
        setFlowNote("Unpaid local path — Graph + AI only");
        const payload = await runScan("/api/scan/local", address);
        setActiveStep("ready");
        setFlowPhase("done");
        setFlowNote("dev-bypass · not a prize settle");
        setReport(payload);
      } else {
        setActiveStep("challenge");
        setFlowNote(
          bypassOn
            ? "DEV_BYPASS_PAYMENT is on — turn it off for prize demos"
            : "x402 gate armed — unpaid calls return 402; agent will settle now",
        );

        setActiveStep("settle");
        setFlowNote(
          rail === "hedera"
            ? "Hedera agent signing USDC via Blocky402…"
            : "Circle agent paying Arc Gateway…",
        );

        const settleStarted = Date.now();
        const tick = window.setInterval(() => {
          const sec = Math.round((Date.now() - settleStarted) / 1000);
          if (sec >= 3) {
            setActiveStep("scan");
            setFlowNote(
              `Still settling / hunting… ${sec}s (${rail === "hedera" ? "Blocky402" : "Gateway"} + Graph + AI)`,
            );
          }
        }, 1000);

        let paid: AuditReport;
        try {
          paid = await runScan(paidScanPath(rail), address);
        } finally {
          window.clearInterval(tick);
        }

        setActiveStep("ready");
        setFlowPhase("done");
        setFlowNote(
          `${paid.sources.payment.rail} · settled=${String(paid.sources.payment.settled)} · ${Math.round((Date.now() - settleStarted) / 1000)}s`,
        );
        setReport(paid);

        // The user asked for the settle proof to open itself — Arc surfaces the
        // agent wallet, Hedera the USDC transfer tx.
        const settleProof =
          paid.sources.payment.rail === "arc-gateway"
            ? paid.sources.payment.agentExplorerUrl ||
              paid.sources.payment.explorerUrl
            : paid.sources.payment.explorerUrl ||
              paid.sources.payment.agentExplorerUrl;
        if (settleProof) window.open(settleProof, "_blank", "noopener,noreferrer");
      }

      requestAnimationFrame(() => {
        document
          .getElementById("dossier")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setFlowPhase("error");
      setFlowNote(err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={report ? "page has-report" : "page"}>
      <TerminalHeader health={health} />

      <ScanConsole
        address={address}
        onAddressChange={setAddress}
        rail={rail}
        onRailChange={setRail}
        busy={busy}
        bypassOn={bypassOn}
        targetPulse={targetPulse}
        steps={steps}
        activeIdx={activeIdx}
        progressPct={progressPct}
        flowPhase={flowPhase}
        flowNote={flowNote}
        logs={logs}
        onSubmit={onScan}
        probe={probe}
        probing={probing}
        probeError={probeError}
        onProbe={() => void onProbe()}
        onProbeDismiss={() => {
          setProbe(null);
          setProbeError(null);
        }}
      />

      <ProofRail health={health} report={report} />

      <CaseFiles address={address} onSelect={selectCaseAddress} />

      <div className="container status-shell">
        {error ? <p className="status error">{error}</p> : null}
      </div>

      {report ? (
        <Dossier
          report={report}
          focusEvidenceId={focusEvidenceId}
          flashEvidenceId={flashEvidenceId}
          onFocusEvidence={focusEvidence}
        />
      ) : null}

      <footer className="site-foot">
        <div className="container foot-inner">
          <span>Ether Hunt</span>
          <span>Hedera x402 · The Graph · Arc Agent Stack</span>
        </div>
      </footer>
    </div>
  );
}
