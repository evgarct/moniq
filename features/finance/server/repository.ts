import "server-only";

import { addDays, format, startOfToday } from "date-fns";

import { validateAccountValues } from "@/features/accounts/lib/account-state";
import { validateCategoryHierarchy } from "@/features/categories/lib/category-tree";
import { generateScheduleOccurrences } from "@/features/transactions/lib/transaction-schedules";
import { validateTransactionRelationships } from "@/features/transactions/lib/transaction-utils";
import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/types/currency";
import type {
  AllocationInput,
  CategoryInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  WalletInput,
} from "@/types/finance-schemas";
import type { Account, Allocation, Category, FinanceSnapshot, Transaction, TransactionSchedule } from "@/types/finance";

type WalletRow = {
  id: string;
  user_id: string;
  name: string;
  type: Account["type"];
  cash_kind: Account["cash_kind"];
  debt_kind: Account["debt_kind"];
  balance: number | string;
  credit_limit: number | string | null;
  currency: CurrencyCode;
  created_at: string;
};

type WalletAllocationRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  name: string;
  kind: Allocation["kind"];
  amount: number | string;
  target_amount: number | string | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  type: Category["type"];
  parent_id: string | null;
  created_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  created_at: string;
  status: Transaction["status"];
  kind: Transaction["kind"];
  amount: number | string;
  destination_amount: number | string | null;
  fx_rate: number | string | null;
  principal_amount: number | string | null;
  interest_amount: number | string | null;
  extra_principal_amount: number | string | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  allocation_id: string | null;
  schedule_id: string | null;
  schedule_occurrence_date: string | null;
  is_schedule_override: boolean | null;
};

type TransactionScheduleRow = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  start_date: string;
  frequency: TransactionSchedule["frequency"];
  until_date: string | null;
  state: TransactionSchedule["state"];
  kind: TransactionSchedule["kind"];
  amount: number | string;
  destination_amount: number | string | null;
  fx_rate: number | string | null;
  principal_amount: number | string | null;
  interest_amount: number | string | null;
  extra_principal_amount: number | string | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  allocation_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapWallet(row: WalletRow): Account {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    cash_kind: row.cash_kind,
    debt_kind: row.debt_kind,
    balance: Number(row.balance),
    credit_limit: row.credit_limit === null ? null : Number(row.credit_limit),
    currency: row.currency,
    created_at: row.created_at,
  };
}

function mapAllocation(row: WalletAllocationRow): Allocation {
  return {
    id: row.id,
    user_id: row.user_id,
    account_id: row.wallet_id,
    name: row.name,
    kind: row.kind,
    amount: Number(row.amount),
    target_amount: row.target_amount === null ? null : Number(row.target_amount),
    created_at: row.created_at,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    icon: row.icon,
    type: row.type,
    parent_id: row.parent_id,
    created_at: row.created_at,
  };
}

function mapSchedule(
  row: TransactionScheduleRow,
  options: {
    accountsById: Map<string, Account>;
    allocationsById: Map<string, Allocation>;
    categoriesById: Map<string, Category>;
    validationError: string | null;
  },
): TransactionSchedule {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    note: row.note,
    start_date: row.start_date,
    frequency: row.frequency,
    until_date: row.until_date,
    state: row.state,
    kind: row.kind,
    amount: Number(row.amount),
    destination_amount: row.destination_amount === null ? null : Number(row.destination_amount),
    fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
    principal_amount: row.principal_amount === null ? null : Number(row.principal_amount),
    interest_amount: row.interest_amount === null ? null : Number(row.interest_amount),
    extra_principal_amount: row.extra_principal_amount === null ? null : Number(row.extra_principal_amount),
    category_id: row.category_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    allocation_id: row.allocation_id,
    category: row.category_id ? options.categoriesById.get(row.category_id) ?? null : null,
    source_account: row.source_account_id ? options.accountsById.get(row.source_account_id) ?? null : null,
    destination_account: row.destination_account_id ? options.accountsById.get(row.destination_account_id) ?? null : null,
    allocation: row.allocation_id ? options.allocationsById.get(row.allocation_id) ?? null : null,
    validation_error: options.validationError,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildTransactionInputFromSchedule(
  schedule: Pick<
    TransactionSchedule,
    | "title"
    | "note"
    | "kind"
    | "amount"
    | "destination_amount"
    | "fx_rate"
    | "principal_amount"
    | "interest_amount"
    | "extra_principal_amount"
    | "category_id"
    | "source_account_id"
    | "destination_account_id"
    | "allocation_id"
  > & { occurred_at: string; status?: Transaction["status"] },
): TransactionInput {
  return {
    title: schedule.title,
    note: schedule.note,
    occurred_at: schedule.occurred_at,
    status: schedule.status === "paid" ? "paid" : "planned",
    kind: schedule.kind,
    amount: schedule.amount,
    destination_amount: schedule.destination_amount,
    fx_rate: schedule.fx_rate,
    principal_amount: schedule.principal_amount,
    interest_amount: schedule.interest_amount,
    extra_principal_amount: schedule.extra_principal_amount,
    category_id: schedule.category_id,
    source_account_id: schedule.source_account_id,
    destination_account_id: schedule.destination_account_id,
    allocation_id: schedule.allocation_id,
  };
}

function normalizeFinanceRepositoryError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "Unable to load finance data.";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("target_amount") ||
    lowerMessage.includes("allocation_kind") ||
    lowerMessage.includes("create_wallet_allocation") ||
    lowerMessage.includes("update_wallet_allocation") ||
    lowerMessage.includes("finance_categories") ||
    lowerMessage.includes("finance_transactions") ||
    lowerMessage.includes("column")
  ) {
    return "Supabase schema is out of date. Run `npx supabase db push` and reload the app.";
  }

  return message;
}

async function getAuthenticatedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

function getScheduleValidationError(
  schedule: TransactionSchedule,
  options: {
    accounts: Account[];
    allocations: Allocation[];
    categories: Category[];
  },
) {
  try {
    validateTransactionRelationships(
      buildTransactionInputFromSchedule({
        ...schedule,
        occurred_at: schedule.start_date,
      }),
      options,
    );
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid recurring transaction schedule.";
  }
}

async function reconcileTransactionSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  schedule: TransactionSchedule,
  existingRows: TransactionRow[],
  horizonStart: string,
  horizonEnd: string,
) {
  const expectedDates = new Set(
    generateScheduleOccurrences(schedule, horizonStart, horizonEnd).map((occurrence) => occurrence.occurrenceDate),
  );
  const rowsByOccurrenceDate = new Map(
    existingRows
      .filter((row) => row.schedule_occurrence_date)
      .map((row) => [row.schedule_occurrence_date!, row]),
  );
  const inserts: Record<string, unknown>[] = [];

  for (const occurrenceDate of expectedDates) {
    const existing = rowsByOccurrenceDate.get(occurrenceDate);
    if (!existing) {
      inserts.push({
        user_id: userId,
        title: schedule.title.trim(),
        note: schedule.note,
        occurred_at: occurrenceDate,
        status: "planned",
        kind: schedule.kind,
        amount: schedule.amount,
        destination_amount: schedule.destination_amount,
        fx_rate: schedule.fx_rate,
        principal_amount: schedule.principal_amount,
        interest_amount: schedule.interest_amount,
        extra_principal_amount: schedule.extra_principal_amount,
        category_id: schedule.category_id,
        source_account_id: schedule.source_account_id,
        destination_account_id: schedule.destination_account_id,
        allocation_id: schedule.allocation_id,
        schedule_id: schedule.id,
        schedule_occurrence_date: occurrenceDate,
        is_schedule_override: false,
      });
      continue;
    }

    const shouldRefreshPlannedOccurrence =
      existing.status === "planned" && !existing.is_schedule_override;

    if (shouldRefreshPlannedOccurrence) {
      const { error } = await supabase
        .from("finance_transactions")
        .update({
          title: schedule.title.trim(),
          note: schedule.note,
          occurred_at: occurrenceDate,
          kind: schedule.kind,
          amount: schedule.amount,
          destination_amount: schedule.destination_amount,
          fx_rate: schedule.fx_rate,
          principal_amount: schedule.principal_amount,
          interest_amount: schedule.interest_amount,
          extra_principal_amount: schedule.extra_principal_amount,
          category_id: schedule.category_id,
          source_account_id: schedule.source_account_id,
          destination_account_id: schedule.destination_account_id,
          allocation_id: schedule.allocation_id,
        })
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (error) {
        throw new Error(normalizeFinanceRepositoryError(error));
      }
    }
  }

  const rowsToDelete = existingRows.filter((row) => {
    if (!row.schedule_occurrence_date) {
      return false;
    }

    if (row.status !== "planned" || row.is_schedule_override) {
      return false;
    }

    return !expectedDates.has(row.schedule_occurrence_date);
  });

  if (rowsToDelete.length) {
    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("user_id", userId)
      .in(
        "id",
        rowsToDelete.map((row) => row.id),
      );

    if (error) {
      throw new Error(normalizeFinanceRepositoryError(error));
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("finance_transactions").insert(inserts);
    if (error) {
      throw new Error(normalizeFinanceRepositoryError(error));
    }
  }
}

export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const { supabase, user } = await getAuthenticatedSupabase();
  const [
    { data: wallets, error: walletError },
    { data: allocations, error: allocationError },
    { data: categories, error: categoryError },
    { data: scheduleRows, error: scheduleError },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, user_id, name, type, cash_kind, debt_kind, balance, credit_limit, currency, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_allocations")
      .select("id, user_id, wallet_id, name, kind, amount, target_amount, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("finance_categories")
      .select("id, user_id, name, icon, type, parent_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("finance_transaction_schedules")
      .select(
        "id, user_id, title, note, start_date, frequency, until_date, state, kind, amount, destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id, destination_account_id, allocation_id, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (walletError) {
    throw new Error(normalizeFinanceRepositoryError(walletError));
  }

  if (allocationError) {
    throw new Error(normalizeFinanceRepositoryError(allocationError));
  }

  if (categoryError) {
    throw new Error(normalizeFinanceRepositoryError(categoryError));
  }

  if (scheduleError) {
    throw new Error(normalizeFinanceRepositoryError(scheduleError));
  }

  const mappedAccounts = (wallets ?? []).map((wallet) => mapWallet(wallet as WalletRow));
  const mappedAllocations = (allocations ?? []).map((allocation) => mapAllocation(allocation as WalletAllocationRow));
  const mappedCategories = (categories ?? []).map((category) => mapCategory(category as CategoryRow));

  const accountsById = new Map(mappedAccounts.map((account) => [account.id, account]));
  const allocationsById = new Map(mappedAllocations.map((allocation) => [allocation.id, allocation]));
  const categoriesById = new Map(mappedCategories.map((category) => [category.id, category]));

  const rawSchedules = (scheduleRows ?? []) as TransactionScheduleRow[];
  const mappedSchedules = rawSchedules.map((row) =>
    mapSchedule(row, {
      accountsById,
      allocationsById,
      categoriesById,
      validationError: null,
    }),
  );

  const validatedSchedules = mappedSchedules.map((schedule) => ({
    ...schedule,
    validation_error: getScheduleValidationError(schedule, {
      accounts: mappedAccounts,
      allocations: mappedAllocations,
      categories: mappedCategories,
    }),
  }));

  const horizonStart = format(startOfToday(), "yyyy-MM-dd");
  const horizonEnd = format(addDays(startOfToday(), 90), "yyyy-MM-dd");

  const activeScheduleIds = validatedSchedules
    .filter((schedule) => schedule.state === "active" && !schedule.validation_error)
    .map((schedule) => schedule.id);

  let existingScheduleTransactions: TransactionRow[] = [];

  if (activeScheduleIds.length) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select(
        "id, user_id, title, note, occurred_at, created_at, status, kind, amount, destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id, destination_account_id, allocation_id, schedule_id, schedule_occurrence_date, is_schedule_override",
      )
      .eq("user_id", user.id)
      .in("schedule_id", activeScheduleIds)
      .gte("schedule_occurrence_date", horizonStart)
      .lte("schedule_occurrence_date", horizonEnd);

    if (error) {
      throw new Error(normalizeFinanceRepositoryError(error));
    }

    existingScheduleTransactions = (data ?? []) as TransactionRow[];

    for (const schedule of validatedSchedules) {
      if (schedule.state !== "active" || schedule.validation_error) {
        continue;
      }

      await reconcileTransactionSchedule(
        supabase,
        user.id,
        schedule,
        existingScheduleTransactions.filter((row) => row.schedule_id === schedule.id),
        horizonStart,
        horizonEnd,
      );
    }
  }

  const { data: transactions, error: transactionError } = await supabase
    .from("finance_transactions")
    .select(
      "id, user_id, title, note, occurred_at, created_at, status, kind, amount, destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id, destination_account_id, allocation_id, schedule_id, schedule_occurrence_date, is_schedule_override",
    )
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (transactionError) {
    throw new Error(normalizeFinanceRepositoryError(transactionError));
  }

  const schedulesById = new Map(validatedSchedules.map((schedule) => [schedule.id, schedule]));
  const mappedTransactions: Transaction[] = (transactions ?? []).map((transaction) => {
    const row = transaction as TransactionRow;

    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      note: row.note,
      occurred_at: row.occurred_at,
      created_at: row.created_at,
      status: row.status,
      kind: row.kind,
      amount: Number(row.amount),
      destination_amount: row.destination_amount === null ? null : Number(row.destination_amount),
      fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
      principal_amount: row.principal_amount === null ? null : Number(row.principal_amount),
      interest_amount: row.interest_amount === null ? null : Number(row.interest_amount),
      extra_principal_amount: row.extra_principal_amount === null ? null : Number(row.extra_principal_amount),
      category_id: row.category_id,
      source_account_id: row.source_account_id,
      destination_account_id: row.destination_account_id,
      allocation_id: row.allocation_id,
      schedule_id: row.schedule_id,
      schedule_occurrence_date: row.schedule_occurrence_date,
      is_schedule_override: row.is_schedule_override ?? false,
      category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
      source_account: row.source_account_id ? accountsById.get(row.source_account_id) ?? null : null,
      destination_account: row.destination_account_id ? accountsById.get(row.destination_account_id) ?? null : null,
      allocation: row.allocation_id ? allocationsById.get(row.allocation_id) ?? null : null,
      schedule: row.schedule_id ? schedulesById.get(row.schedule_id) ?? null : null,
    };
  });

  return {
    accounts: mappedAccounts,
    allocations: mappedAllocations,
    categories: mappedCategories,
    schedules: validatedSchedules,
    transactions: mappedTransactions,
  };
}

export async function createWallet(values: WalletInput) {
  const { supabase } = await getAuthenticatedSupabase();
  validateAccountValues(values);
  const { error } = await supabase.rpc("create_wallet", {
    _name: values.name,
    _type: values.type,
    _balance: values.balance,
    _credit_limit: values.type === "credit_card" ? values.credit_limit ?? null : null,
    _currency: values.currency,
    _debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateWallet(walletId: string, values: WalletInput) {
  const { supabase } = await getAuthenticatedSupabase();
  validateAccountValues(values);
  const { error } = await supabase.rpc("update_wallet", {
    _wallet_id: walletId,
    _name: values.name,
    _type: values.type,
    _balance: values.balance,
    _credit_limit: values.type === "credit_card" ? values.credit_limit ?? null : null,
    _currency: values.currency,
    _debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function deleteWallet(walletId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("delete_wallet", {
    _wallet_id: walletId,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function createWalletAllocation(walletId: string, values: AllocationInput) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("create_wallet_allocation", {
    _wallet_id: walletId,
    _name: values.name,
    _kind: values.kind,
    _amount: values.amount,
    _target_amount: values.target_amount,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateWalletAllocation(allocationId: string, values: AllocationInput) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("update_wallet_allocation", {
    _allocation_id: allocationId,
    _name: values.name,
    _kind: values.kind,
    _amount: values.amount,
    _target_amount: values.target_amount,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function deleteWalletAllocation(allocationId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("delete_wallet_allocation", {
    _allocation_id: allocationId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createCategory(values: CategoryInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();

  validateCategoryHierarchy(snapshot.categories, {
    parent_id: values.parent_id ?? null,
    type: values.type,
  });

  const { error } = await supabase.from("finance_categories").insert({
    user_id: user.id,
    name: values.name.trim(),
    icon: values.icon?.trim() || null,
    type: values.type,
    parent_id: values.parent_id ?? null,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateCategory(categoryId: string, values: CategoryInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const existing = snapshot.categories.find((category) => category.id === categoryId);

  if (!existing) {
    throw new Error("Category not found.");
  }

  validateCategoryHierarchy(snapshot.categories, {
    categoryId,
    parent_id: values.parent_id ?? null,
    type: values.type,
  });

  const { error } = await supabase
    .from("finance_categories")
    .update({
      name: values.name.trim(),
      icon: values.icon?.trim() || null,
      type: values.type,
      parent_id: values.parent_id ?? null,
    })
    .eq("id", categoryId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function deleteCategory(categoryId: string, replacementCategoryId: string | null) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const existing = snapshot.categories.find((category) => category.id === categoryId);

  if (!existing) {
    throw new Error("Category not found.");
  }

  const transactionsUsingCategory = snapshot.transactions.filter((transaction) => transaction.category_id === categoryId);

  if (transactionsUsingCategory.length > 0 && !replacementCategoryId) {
    throw new Error("Choose a replacement category before deleting this category.");
  }

  if (replacementCategoryId) {
    const replacement = snapshot.categories.find((category) => category.id === replacementCategoryId);

    if (!replacement) {
      throw new Error("Replacement category not found.");
    }

    if (replacement.id === categoryId) {
      throw new Error("Replacement category must be different.");
    }

    if (replacement.type !== existing.type) {
      throw new Error("Replacement category must have the same type.");
    }

    const { error: reassignError } = await supabase
      .from("finance_transactions")
      .update({ category_id: replacementCategoryId })
      .eq("user_id", user.id)
      .eq("category_id", categoryId);

    if (reassignError) {
      throw new Error(normalizeFinanceRepositoryError(reassignError));
    }
  }

  const { error: reparentError } = await supabase
    .from("finance_categories")
    .update({ parent_id: existing.parent_id })
    .eq("user_id", user.id)
    .eq("parent_id", categoryId);

  if (reparentError) {
    throw new Error(normalizeFinanceRepositoryError(reparentError));
  }

  const { error } = await supabase
    .from("finance_categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function createTransactionEntry(values: TransactionEntryInput) {
  if (values.recurrence) {
    const scheduleValues: TransactionScheduleInput = {
      title: values.title,
      note: values.note,
      occurred_at: values.occurred_at,
      kind: values.kind,
      amount: values.amount,
      destination_amount: values.destination_amount,
      fx_rate: values.fx_rate,
      principal_amount: values.principal_amount,
      interest_amount: values.interest_amount,
      extra_principal_amount: values.extra_principal_amount,
      category_id: values.category_id,
      source_account_id: values.source_account_id,
      destination_account_id: values.destination_account_id,
      allocation_id: values.allocation_id,
      recurrence: values.recurrence,
    };

    await createTransactionSchedule(scheduleValues);
    return;
  }

  await createTransaction(values);
}

export async function createTransactionEntryBatch(entries: TransactionEntryInput[]) {
  for (const entry of entries) {
    await createTransactionEntry(entry);
  }
}

export async function createTransaction(values: TransactionInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();

  validateTransactionRelationships(values, snapshot);

  const { error } = await supabase.from("finance_transactions").insert({
    user_id: user.id,
    title: values.title.trim(),
    note: values.note,
    occurred_at: values.occurred_at,
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount,
    fx_rate: values.fx_rate,
    principal_amount: values.principal_amount,
    interest_amount: values.interest_amount,
    extra_principal_amount: values.extra_principal_amount,
    category_id: values.category_id,
    source_account_id: values.source_account_id,
    destination_account_id: values.destination_account_id,
    allocation_id: values.allocation_id,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function createTransactionSchedule(values: TransactionScheduleInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const transactionTemplate = buildTransactionInputFromSchedule({
    title: values.title,
    note: values.note ?? null,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount ?? null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.principal_amount ?? null,
    interest_amount: values.interest_amount ?? null,
    extra_principal_amount: values.extra_principal_amount ?? null,
    category_id: values.category_id ?? null,
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
    allocation_id: values.allocation_id ?? null,
    occurred_at: values.occurred_at,
  });

  validateTransactionRelationships(transactionTemplate, snapshot);

  const { error } = await supabase.from("finance_transaction_schedules").insert({
    user_id: user.id,
    title: values.title.trim(),
    note: values.note,
    start_date: values.occurred_at,
    frequency: values.recurrence.frequency,
    until_date: values.recurrence.until_date,
    state: "active",
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount,
    fx_rate: values.fx_rate,
    principal_amount: values.principal_amount,
    interest_amount: values.interest_amount,
    extra_principal_amount: values.extra_principal_amount,
    category_id: values.category_id,
    source_account_id: values.source_account_id,
    destination_account_id: values.destination_account_id,
    allocation_id: values.allocation_id,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateTransaction(transactionId: string, values: TransactionInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);

  if (!existing) {
    throw new Error("Transaction not found.");
  }

  validateTransactionRelationships(values, snapshot);

  const updateFields: Record<string, unknown> = {
    title: values.title.trim(),
    note: values.note,
    occurred_at: values.occurred_at,
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount,
    fx_rate: values.fx_rate,
    principal_amount: values.principal_amount,
    interest_amount: values.interest_amount,
    extra_principal_amount: values.extra_principal_amount,
    category_id: values.category_id,
    source_account_id: values.source_account_id,
    destination_account_id: values.destination_account_id,
    allocation_id: values.allocation_id,
  };

  // Mark as overridden so the reconciler doesn't overwrite manual edits
  if (existing.schedule_id) {
    updateFields.is_schedule_override = true;
  }

  const { error } = await supabase
    .from("finance_transactions")
    .update(updateFields)
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateTransactionSchedule(scheduleId: string, values: TransactionScheduleInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const existing = snapshot.schedules.find((schedule) => schedule.id === scheduleId);

  if (!existing) {
    throw new Error("Transaction schedule not found.");
  }

  validateTransactionRelationships(
    buildTransactionInputFromSchedule({
      title: values.title,
      note: values.note ?? null,
      kind: values.kind,
      amount: values.amount,
      destination_amount: values.destination_amount ?? null,
      fx_rate: values.fx_rate ?? null,
      principal_amount: values.principal_amount ?? null,
      interest_amount: values.interest_amount ?? null,
      extra_principal_amount: values.extra_principal_amount ?? null,
      category_id: values.category_id ?? null,
      source_account_id: values.source_account_id ?? null,
      destination_account_id: values.destination_account_id ?? null,
      allocation_id: values.allocation_id ?? null,
      occurred_at: values.occurred_at,
    }),
    snapshot,
  );

  const { error } = await supabase
    .from("finance_transaction_schedules")
    .update({
      title: values.title.trim(),
      note: values.note,
      start_date: values.occurred_at,
      frequency: values.recurrence.frequency,
      until_date: values.recurrence.until_date,
      kind: values.kind,
      amount: values.amount,
      destination_amount: values.destination_amount,
      fx_rate: values.fx_rate,
      principal_amount: values.principal_amount,
      interest_amount: values.interest_amount,
      extra_principal_amount: values.extra_principal_amount,
      category_id: values.category_id,
      source_account_id: values.source_account_id,
      destination_account_id: values.destination_account_id,
      allocation_id: values.allocation_id,
    })
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function setTransactionScheduleState(scheduleId: string, state: TransactionSchedule["state"]) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from("finance_transaction_schedules")
    .update({ state })
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function markTransactionPaid(transactionId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from("finance_transactions")
    .update({ status: "paid" })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .eq("status", "planned");

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function skipTransactionOccurrence(transactionId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from("finance_transactions")
    .update({ status: "skipped" })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .eq("status", "planned");

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function deleteTransactionSchedule(scheduleId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const today = format(startOfToday(), "yyyy-MM-dd");
  const { error: deleteFutureOccurrencesError } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("schedule_id", scheduleId)
    .neq("status", "paid")
    .gte("schedule_occurrence_date", today);

  if (deleteFutureOccurrencesError) {
    throw new Error(normalizeFinanceRepositoryError(deleteFutureOccurrencesError));
  }

  const { error } = await supabase
    .from("finance_transaction_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function rescheduleScheduleFromDate(
  scheduleId: string,
  fromOccurrenceDate: string,
  newOccurrenceDate: string,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const schedule = snapshot.schedules.find((s) => s.id === scheduleId);

  if (!schedule) {
    throw new Error("Schedule not found.");
  }

  // Shift the schedule anchor by the same offset as the date change
  const fromMs = new Date(fromOccurrenceDate).getTime();
  const newMs = new Date(newOccurrenceDate).getTime();
  const offsetDays = Math.round((newMs - fromMs) / 86_400_000);
  const newStartDate = format(addDays(new Date(schedule.start_date), offsetDays), "yyyy-MM-dd");

  const { error: scheduleError } = await supabase
    .from("finance_transaction_schedules")
    .update({ start_date: newStartDate })
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (scheduleError) {
    throw new Error(normalizeFinanceRepositoryError(scheduleError));
  }

  // Delete all non-overridden planned occurrences from the original date onwards
  // so the reconciler regenerates them at the shifted dates
  const { error: deleteError } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("schedule_id", scheduleId)
    .eq("status", "planned")
    .eq("is_schedule_override", false)
    .gte("occurred_at", fromOccurrenceDate);

  if (deleteError) {
    throw new Error(normalizeFinanceRepositoryError(deleteError));
  }
}

export async function deleteTransaction(transactionId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}
