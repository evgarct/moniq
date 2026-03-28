import { createClientId } from "@/lib/utils";
import type { Account, Allocation } from "@/types/finance";

export type AllocationDraftValues = {
  name: string;
  amount: number;
};

type IdFactory = (prefix: string) => string;

type CreateAllocationOptions = {
  account: Account;
  values: AllocationDraftValues;
  now?: string;
  idFactory?: IdFactory;
};

export function validateAllocationAmount(values: {
  balance: number;
  allocations: Allocation[];
  accountId: string;
  nextAmount: number;
  editingAllocationId?: string;
}) {
  if (values.nextAmount < 0) {
    throw new Error("Allocation amount cannot go below 0.");
  }

  const reservedWithoutCurrent = values.allocations
    .filter((allocation) => allocation.account_id === values.accountId)
    .filter((allocation) => allocation.id !== values.editingAllocationId)
    .reduce((sum, allocation) => sum + allocation.amount, 0);

  if (reservedWithoutCurrent + values.nextAmount > values.balance) {
    throw new Error("This allocation would exceed the available savings balance.");
  }
}

export function createAllocation({
  account,
  values,
  now = new Date().toISOString(),
  idFactory = createClientId,
}: CreateAllocationOptions): Allocation {
  return {
    id: idFactory("allocation"),
    user_id: account.user_id,
    account_id: account.id,
    name: values.name,
    amount: values.amount,
    created_at: now,
  };
}

export function saveAllocation(options: {
  allocations: Allocation[];
  account: Account;
  values: AllocationDraftValues;
  editingAllocation?: Allocation | null;
  now?: string;
  idFactory?: IdFactory;
}) {
  validateAllocationAmount({
    balance: options.account.balance,
    allocations: options.allocations,
    accountId: options.account.id,
    nextAmount: options.values.amount,
    editingAllocationId: options.editingAllocation?.id,
  });

  if (options.editingAllocation) {
    return options.allocations.map((allocation) =>
      allocation.id === options.editingAllocation?.id
        ? {
            ...allocation,
            name: options.values.name,
            amount: options.values.amount,
          }
        : allocation,
    );
  }

  return [
    ...options.allocations,
    createAllocation({
      account: options.account,
      values: options.values,
      now: options.now,
      idFactory: options.idFactory,
    }),
  ];
}

export function deleteAllocation(allocations: Allocation[], allocationId: string) {
  return allocations.filter((allocation) => allocation.id !== allocationId);
}
