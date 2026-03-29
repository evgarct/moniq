import { createClientId } from "@/lib/utils";
import type { Account, Allocation, AllocationKind } from "@/types/finance";

export type AllocationDraftValues = {
  name: string;
  amount: number;
  kind: AllocationKind;
  target_amount?: number | null;
};

type IdFactory = (prefix: string) => string;

type CreateAllocationOptions = {
  account: Account;
  values: AllocationDraftValues;
  now?: string;
  idFactory?: IdFactory;
};

function normalizeAllocationValues(values: AllocationDraftValues) {
  return {
    ...values,
    target_amount: values.kind === "goal_targeted" ? values.target_amount ?? null : null,
  };
}

export function validateAllocationAmount(values: {
  balance: number;
  allocations: Allocation[];
  accountId: string;
  nextAmount: number;
  nextKind: AllocationKind;
  nextTargetAmount?: number | null;
  editingAllocationId?: string;
}) {
  if (values.nextAmount < 0) {
    throw new Error("Allocation amount cannot go below 0.");
  }

  if (values.nextKind === "goal_targeted" && (values.nextTargetAmount == null || values.nextTargetAmount <= 0)) {
    throw new Error("Target amount is required for a targeted goal.");
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
  const normalizedValues = normalizeAllocationValues(values);

  return {
    id: idFactory("allocation"),
    user_id: account.user_id,
    account_id: account.id,
    name: normalizedValues.name,
    kind: normalizedValues.kind,
    amount: normalizedValues.amount,
    target_amount: normalizedValues.target_amount,
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
  const normalizedValues = normalizeAllocationValues(options.values);

  validateAllocationAmount({
    balance: options.account.balance,
    allocations: options.allocations,
    accountId: options.account.id,
    nextAmount: normalizedValues.amount,
    nextKind: normalizedValues.kind,
    nextTargetAmount: normalizedValues.target_amount,
    editingAllocationId: options.editingAllocation?.id,
  });

  if (options.editingAllocation) {
    return options.allocations.map((allocation) =>
      allocation.id === options.editingAllocation?.id
        ? {
            ...allocation,
            name: normalizedValues.name,
            kind: normalizedValues.kind,
            amount: normalizedValues.amount,
            target_amount: normalizedValues.target_amount,
          }
        : allocation,
    );
  }

  return [
    ...options.allocations,
    createAllocation({
      account: options.account,
      values: normalizedValues,
      now: options.now,
      idFactory: options.idFactory,
    }),
  ];
}

export function deleteAllocation(allocations: Allocation[], allocationId: string) {
  return allocations.filter((allocation) => allocation.id !== allocationId);
}
