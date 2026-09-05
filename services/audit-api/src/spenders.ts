/**
 * Address labels used for both evidence copy and detector logic.
 *
 * Detectors read these by address, never by matching formatted prose — the
 * display strings are free to change without breaking analysis.
 */
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";

const LABELS: Record<string, string> = {
  [PERMIT2]: "Uniswap Permit2",
  "0xc36442b4a4522e871399cd717abdd847ab11fe88":
    "Uniswap V3 NonfungiblePositionManager",
  "0x40aa958dd87fc8305b97f2ba922cddca374bcd7f": "Circle TokenMessenger",
  "0xbd3fa81b58ba92a82136038b25adec7066af3155": "Circle TokenMessenger (alt)",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap Universal Router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch Aggregation Router V5",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Universal Router (alt)",

  // Lending / AMM cores.
  "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": "Morpho Blue",
  "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer Vault",

  // ERC-4626 vaults, names read from the contracts' own name() getter.
  "0xbeef01735c132ada46aa9aa4c54623caa92a64cb": "Steakhouse USDC vault",
  "0xbeeff047c03714965a54b671a37c18bef6b96210": "Waterline Reservoir USDC vault",
  "0x9b5e92fd227876b4c07a8c02367e2cb23c639dfa": "Clearstar Yield USDC vault",
  "0x5426178799ee0a0181a89b4f57efddfab49941ec": "Curve TricryptoINV pool",
};

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function labelFor(address: string): string | undefined {
  return LABELS[address.toLowerCase()];
}

/** `0x1234…abcd (Uniswap Permit2)` when known, short form otherwise. */
export function describeAddress(address: string): string {
  const label = labelFor(address);
  return label ? `${shortAddress(address)} (${label})` : shortAddress(address);
}

export function isPermit2(address: string | undefined): boolean {
  return address?.toLowerCase() === PERMIT2;
}

/** A labelled contract is a known integration, not an unidentified operator. */
export function isKnownIntegration(address: string | undefined): boolean {
  return address ? LABELS[address.toLowerCase()] !== undefined : false;
}
