type Preset = { label: string; value: string; note: string };

/**
 * Every entry is verified to return subject-scoped rows from the deployed
 * subgraph. Historic exploit addresses were removed: the index starts at
 * mainnet block 19,000,000, so pre-2024 wallets can only ever return an empty
 * dossier, and shipping a button that scans to nothing is worse than shipping
 * fewer buttons.
 */
export const CASE_FILES: Preset[] = [
  {
    label: "Widest exposure",
    value: "0x00000f91109c4d0007e90000d9facad5298a0cac",
    note: "Contract · dozens of live unlimited grants, most to unnamed spenders",
  },
  {
    label: "Unnamed spenders",
    value: "0x63242a4ea82847b20e506b63b0e2e2eff0cc6cb0",
    note: "Contract · six escalations alongside a recognised Permit2 grant",
  },
  {
    label: "Half recognised",
    value: "0x4a6c312ec70e8747a587ee860a0353cd42be0ae0",
    note: "Contract · Morpho and vault grants named, four unnamed escalated",
  },
  {
    label: "Short enough to read",
    value: "0xbbc133749e308694277aaa82ac780eb8aaed77f6",
    note: "Contract · three escalations, small enough to check end to end",
  },
  {
    label: "Named DeFi stack",
    value: "0x4de4fccc14eab1d69890a49471a9d57b96dd725f",
    note: "Contract · Morpho, Balancer and Curve identified — one outlier left",
  },
  {
    label: "No false alarms",
    value: "0x0218033bc4c88e91a6cc9a6aceee421dda39448d",
    note: "Wallet · unlimited to Permit2 and Circle, so nothing escalates",
  },
  {
    label: "vitalik.eth",
    value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    note: "Clean baseline · scores low, which is how you know high means something",
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
          Live mainnet subjects, ordered from worst exposure to clean. The last
          two are here so you can watch the scanner stay quiet when nothing is
          actually wrong.
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
