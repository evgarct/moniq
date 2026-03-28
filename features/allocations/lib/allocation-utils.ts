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
