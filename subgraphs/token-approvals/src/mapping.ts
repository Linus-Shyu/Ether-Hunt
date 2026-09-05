import { BigInt } from "@graphprotocol/graph-ts";
import { Approval } from "../generated/ERC20ApprovalProbe/ERC20";
import { Account, Allowance, ApprovalEvent, Spender } from "../generated/schema";

/**
 * Anything above 1e38 is an infinite allowance in practice — max uint256 and the
 * various "big enough to never run out" values dapps use both land above it.
 */
const UNLIMITED_THRESHOLD = BigInt.fromString(
  "100000000000000000000000000000000000000",
);

function loadAccount(id: string, timestamp: BigInt): Account {
  const existing = Account.load(id);
  if (existing != null) {
    return existing;
  }
  const account = new Account(id);
  account.approvalCount = 0;
  account.unlimitedGrantCount = 0;
  account.liveUnlimitedCount = 0;
  account.revokeCount = 0;
  account.distinctSpenderPairs = 0;
  account.firstSeen = timestamp;
  account.lastSeen = timestamp;
  return account;
}

function loadSpender(id: string, timestamp: BigInt): Spender {
  const existing = Spender.load(id);
  if (existing != null) {
    return existing;
  }
  const spender = new Spender(id);
  spender.approvalCount = 0;
  spender.unlimitedReceivedCount = 0;
  spender.liveUnlimitedCount = 0;
  spender.distinctOwnerPairs = 0;
  spender.firstSeen = timestamp;
  spender.lastSeen = timestamp;
  return spender;
}

export function handleApproval(event: Approval): void {
  const timestamp = event.block.timestamp;
  const token = event.address;
  const ownerAddress = event.params.owner;
  const spenderAddress = event.params.spender;
  const value = event.params.value;

  const unlimited = value.gt(UNLIMITED_THRESHOLD);
  const revoked = value.equals(BigInt.zero());

  const account = loadAccount(ownerAddress.toHexString(), timestamp);
  const spender = loadSpender(spenderAddress.toHexString(), timestamp);

  const allowanceId =
    token.toHexString() +
    "-" +
    ownerAddress.toHexString() +
    "-" +
    spenderAddress.toHexString();

  const previous = Allowance.load(allowanceId);
  let allowance: Allowance;
  let wasUnlimited = false;

  if (previous == null) {
    allowance = new Allowance(allowanceId);
    allowance.token = token;
    allowance.owner = account.id;
    allowance.spender = spender.id;
    allowance.approvalCount = 0;
    allowance.revokeCount = 0;
    allowance.peakValue = BigInt.zero();
    allowance.firstSeen = timestamp;
    account.distinctSpenderPairs = account.distinctSpenderPairs + 1;
    spender.distinctOwnerPairs = spender.distinctOwnerPairs + 1;
  } else {
    allowance = previous;
    wasUnlimited = allowance.unlimited;
  }

  allowance.currentValue = value;
  allowance.unlimited = unlimited;
  allowance.revoked = revoked;
  if (value.gt(allowance.peakValue)) {
    allowance.peakValue = value;
  }
  allowance.approvalCount = allowance.approvalCount + 1;
  if (revoked) {
    allowance.revokeCount = allowance.revokeCount + 1;
  }
  allowance.lastSeen = timestamp;
  allowance.lastTransactionHash = event.transaction.hash;

  // Standing exposure only changes when a pair crosses the unlimited boundary,
  // so both roles stay accurate without rescanning their allowance lists.
  if (unlimited && !wasUnlimited) {
    account.liveUnlimitedCount = account.liveUnlimitedCount + 1;
    spender.liveUnlimitedCount = spender.liveUnlimitedCount + 1;
  } else if (!unlimited && wasUnlimited) {
    account.liveUnlimitedCount = account.liveUnlimitedCount - 1;
    spender.liveUnlimitedCount = spender.liveUnlimitedCount - 1;
  }

  account.approvalCount = account.approvalCount + 1;
  spender.approvalCount = spender.approvalCount + 1;
  if (unlimited) {
    account.unlimitedGrantCount = account.unlimitedGrantCount + 1;
    spender.unlimitedReceivedCount = spender.unlimitedReceivedCount + 1;
  }
  if (revoked) {
    account.revokeCount = account.revokeCount + 1;
  }
  account.lastSeen = timestamp;
  spender.lastSeen = timestamp;

  const approval = new ApprovalEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString(),
  );
  approval.token = token;
  approval.owner = ownerAddress;
  approval.spender = spenderAddress;
  approval.value = value;
  approval.blockNumber = event.block.number;
  approval.timestamp = timestamp;
  approval.transactionHash = event.transaction.hash;
  approval.unlimited = unlimited;
  approval.revoke = revoked;
  approval.allowance = allowance.id;

  allowance.save();
  account.save();
  spender.save();
  approval.save();
}
