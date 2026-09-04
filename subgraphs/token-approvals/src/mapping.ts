import { Approval } from "../generated/ERC20ApprovalProbe/ERC20";
import { ApprovalEvent } from "../generated/schema";

export function handleApproval(event: Approval): void {
  let entity = new ApprovalEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString(),
  );
  entity.token = event.address;
  entity.owner = event.params.owner;
  entity.spender = event.params.spender;
  entity.value = event.params.value;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
