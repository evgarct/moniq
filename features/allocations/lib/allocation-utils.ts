import type { Allocation } from "@/types/finance";
export {
  createAllocation,
  deleteAllocation,
  saveAllocation,
  validateAllocationAmount,
} from "@/features/allocations/lib/allocation-state";

export function getAllocationsForAccount(allocations: Allocation[], accountId: string) {
  return allocations.filter((allocation) => allocation.account_id === accountId);
}

export function getAllocatedTotalForAccount(allocations: Allocation[], accountId: string) {
  return getAllocationsForAccount(allocations, accountId).reduce((sum, allocation) => sum + allocation.amount, 0);
}

export function getFreeMoney(balance: number, allocations: Allocation[], accountId: string) {
  return balance - getAllocatedTotalForAccount(allocations, accountId);
}

export function isTargetedAllocation(allocation: Allocation) {
  return allocation.kind === "goal_targeted" && allocation.target_amount !== null;
}

export function getAllocationProgress(allocation: Allocation) {
  if (!isTargetedAllocation(allocation) || allocation.target_amount === null || allocation.target_amount <= 0) {
    return null;
  }

  return Math.min(allocation.amount / allocation.target_amount, 1);
}
