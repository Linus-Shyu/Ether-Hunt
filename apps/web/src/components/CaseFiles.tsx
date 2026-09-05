import { CASE_FILES } from "@ether-hunt/shared";

type Props = {
  address: string;
  onSelect: (value: string) => void;
};

export { CASE_FILES };

export function CaseFiles({ address, onSelect }: Props) {
  return (
    <section className="cases">
      <div className="container">
        <h2 className="section-title">Case files</h2>
        <p className="section-lead">
          Nine live mainnet subjects, ordered from worst exposure to clean. The
          API keeps these presets warm and falls back to the fully-synced Graph
          deployment while allowance-state v0.0.2 is still catching up — so a
          3–5 minute review never opens an empty dossier.
        </p>
        <div className="presets">
          {CASE_FILES.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={
                address.toLowerCase() === preset.value.toLowerCase()
                  ? "preset active"
                  : "preset"
              }
              onClick={() => onSelect(preset.value)}
            >
              <span className="preset-label">{preset.label}</span>
              <span className="preset-note">{preset.note}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
