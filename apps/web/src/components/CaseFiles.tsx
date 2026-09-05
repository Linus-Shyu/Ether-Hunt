type Preset = { label: string; value: string; note: string };

export const CASE_FILES: Preset[] = [
  {
    label: "Dense USDC",
    value: "0x0218033bc4c88e91a6cc9a6aceee421dda39448d",
    note: "Rich approval constellation — best graph demo",
  },
  {
    label: "Ronin Bridge ’22",
    value: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    note: "$624M validator key compromise",
  },
  {
    label: "Poly Network ’21",
    value: "0xC8a65Fadf0e0dDAf421F28FEAb69Bf6E2E589963",
    note: "$611M cross-chain keeper flaw",
  },
  {
    label: "Nomad Bridge ’22",
    value: "0x56D8B635A7C88Fd1104D23d632AF40c1C3Aac4e3",
    note: "$190M replayable proof bug",
  },
  {
    label: "Beanstalk ’22",
    value: "0x1c5dCdd006EA78a7E4783f9e6021C32935a10fb4",
    note: "$182M flash-loan governance seizure",
  },
  {
    label: "BadgerDAO ’21",
    value: "0x1FCdb04d0C5364FBd92C73cA8AF9BAA72c269107",
    note: "$120M malicious approval injection",
  },
  {
    label: "Euler Finance ’23",
    value: "0xb66cd966670d962C227B3eABA30a872DbFB995db",
    note: "$197M donation accounting exploit",
  },
  {
    label: "Bybit cold wallet ’25",
    value: "0x47666Fab8bd0Ac7003bce3f5C3585383F09486E2",
    note: "$1.5B signing-interface compromise",
  },
  {
    label: "vitalik.eth",
    value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    note: "Clean baseline — proves no false positives",
  },
];

type Props = {
  address: string;
  onSelect: (value: string) => void;
};

export function CaseFiles({ address, onSelect }: Props) {
  return (
    <section className="cases">
      <div className="container">
        <h2 className="section-title">Case files</h2>
        <p className="section-lead">
          Nine real subjects — eight historic exploits plus one clean wallet, so
          you can watch the scanner stay quiet when nothing is wrong.
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
