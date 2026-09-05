import type { RiskScore } from "../lib/risk";

const R = 52;
const CIRC = Math.PI * R; // semicircle length

/** Semicircular exposure gauge — one glance tells a judge how bad it is. */
export function RiskMeter({ risk }: { risk: RiskScore }) {
  const filled = (risk.score / 100) * CIRC;

  return (
    <div className={`risk-meter band-${risk.band}`}>
      <svg viewBox="0 0 128 78" role="img" aria-label={`${risk.label}, score ${risk.score} of 100`}>
        <path
          className="risk-track"
          d={`M ${64 - R} 66 A ${R} ${R} 0 0 1 ${64 + R} 66`}
          fill="none"
        />
        <path
          className="risk-fill"
          d={`M ${64 - R} 66 A ${R} ${R} 0 0 1 ${64 + R} 66`}
          fill="none"
          strokeDasharray={`${filled} ${CIRC}`}
        />
        <text className="risk-value" x="64" y="60" textAnchor="middle">
          {risk.score}
        </text>
      </svg>
      <p className="risk-label">{risk.label}</p>
      <p className="risk-sub">
        {risk.counts.critical + risk.counts.high} high+ · {risk.counts.medium}{" "}
        medium · {risk.counts.low + risk.counts.info} informational
      </p>
    </div>
  );
}
