import { formatAmount, formatDuration, type ChallengeProbe } from "../lib/api";
import type { PayRail } from "../lib/paymentFlow";

type Props = {
  rail: PayRail;
  probe: ChallengeProbe | null;
  probing: boolean;
  error: string | null;
  onProbe: () => void;
  onDismiss: () => void;
};

const RAIL_LABEL: Record<PayRail, string> = {
  local: "local",
  hedera: "POST /audit",
  arc: "POST /audit/arc",
};

export function ChallengeViewer({
  rail,
  probe,
  probing,
  error,
  onProbe,
  onDismiss,
}: Props) {
  if (rail === "local") return null;

  const accept = probe?.challenge?.accepts?.[0];
  // Hedera's `extra` carries a feePayer; Arc's carries the Gateway contract name.
  const settlement =
    typeof accept?.extra?.name === "string" ? accept.extra.name : undefined;

  return (
    <div className="challenge">
      <div className="challenge-head">
        <span className="section-label">x402 gate</span>
        <button
          type="button"
          className="challenge-btn"
          onClick={onProbe}
          disabled={probing}
        >
          {probing ? "Probing…" : `Prove the gate · ${RAIL_LABEL[rail]}`}
        </button>
        {probe || error ? (
          <button type="button" className="challenge-close" onClick={onDismiss}>
            Clear
          </button>
        ) : null}
      </div>

      {!probe && !error ? (
        <p className="challenge-hint">
          Sends one unpaid request to the gated endpoint. A compliant x402
          server must answer <code>402</code> with a machine-readable payment
          challenge — no payment is made.
        </p>
      ) : null}

      {error ? <p className="challenge-err">{error}</p> : null}

      {probe ? (
        <div className={probe.gated ? "challenge-body ok" : "challenge-body bad"}>
          <div className="challenge-status">
            <span className="http-code">HTTP {probe.status}</span>
            <span className="http-verdict">
              {probe.gated ? "PAYMENT REQUIRED — gate live" : "NOT GATED"}
            </span>
          </div>

          {accept ? (
            <dl className="challenge-grid">
              <div>
                <dt>scheme</dt>
                <dd>{accept.scheme}</dd>
              </div>
              <div>
                <dt>network</dt>
                <dd>{accept.network}</dd>
              </div>
              <div>
                <dt>price</dt>
                <dd>{formatAmount(accept.amount)} USDC</dd>
              </div>
              <div>
                <dt>asset</dt>
                <dd className="ellipsis">{accept.asset}</dd>
              </div>
              <div>
                <dt>payTo</dt>
                <dd className="ellipsis">{accept.payTo}</dd>
              </div>
              <div>
                <dt>{settlement ? "settles via" : "valid for"}</dt>
                <dd className="ellipsis">
                  {settlement ?? formatDuration(accept.maxTimeoutSeconds)}
                </dd>
              </div>
            </dl>
          ) : null}

          <p className="challenge-note">{probe.note}</p>

          {probe.raw ? (
            <details className="challenge-raw">
              <summary>Raw challenge · payment-required header</summary>
              <pre>{probe.raw}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
