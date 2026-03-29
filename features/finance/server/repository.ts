import "server-only";

import { validateCategoryHierarchy } from "@/features/categories/lib/category-tree";
import { validateTransactionRelationships } from "@/features/transactions/lib/transaction-utils";
import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/types/currency";
import type {
  AllocationInput,
  CategoryInput,
  TransactionInput,
  WalletInput,
} from "@/types/finance-schemas";
import type { Account, Allocation, Category, FinanceSnapshot, Transaction } from "@/types/finance";

type WalletRow = {
  id: string;
  user_id: string;
  name: string;
  type: Account["type"];
  cash_kind: Account["cash_kind"];
  debt_kind: Account["debt_kind"];
  balance: number | string;
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

export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const { supabase, user } = await getAuthenticatedSupabase();
  const [
    { data: wallets, error: walletError },
    { data: allocations, error: allocationError },
    { data: categories, error: categoryError },
    { data: transactions, error: transactionError },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, user_id, name, type, cash_kind, debt_kind, balance, currency, created_at")
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
      .from("finance_transactions")
      .select(
        "id, user_id, title, note, occurred_at, created_at, status, kind, amount, destination_amount, fx_rate, principal_amount, interest_amount, extra_principal_amount, category_id, source_account_id, destination_account_id, allocation_id",
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
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

  if (transactionError) {
    throw new Error(normalizeFinanceRepositoryError(transactionError));
  }

  const mappedAccounts = (wallets ?? []).map((wallet) => mapWallet(wallet as WalletRow));
  const mappedAllocations = (allocations ?? []).map((allocation) => mapAllocation(allocation as WalletAllocationRow));
  const mappedCategories = (categories ?? []).map((category) => mapCategory(category as CategoryRow));

  const accountsById = new Map(mappedAccounts.map((account) => [account.id, account]));
  const allocationsById = new Map(mappedAllocations.map((allocation) => [allocation.id, allocation]));
  const categoriesById = new Map(mappedCategories.map((category) => [category.id, category]));

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
      category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
      source_account: row.source_account_id ? accountsById.get(row.source_account_id) ?? null : null,
      destination_account: row.destination_account_id ? accountsById.get(row.destination_account_id) ?? null : null,
      allocation: row.allocation_id ? allocationsById.get(row.allocation_id) ?? null : null,
    };
  });

  return {
    accounts: mappedAccounts,
    allocations: mappedAllocations,
    categories: mappedCategories,
    transactions: mappedTransactions,
  };
}

export async function createWallet(values: WalletInput) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("create_wallet", {
    _name: values.name,
    _type: values.type,
    _balance: values.balance,
    _currency: values.currency,
    _debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
  });

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
  }
}

export async function updateWallet(walletId: string, values: WalletInput) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("update_wallet", {
    _wallet_id: walletId,
    _name: values.name,
    _type: values.type,
    _balance: values.balance,
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

export async function updateTransaction(transactionId: string, values: TransactionInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getFinanceSnapshot();
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);

  if (!existing) {
    throw new Error("Transaction not found.");
  }

  validateTransactionRelationships(values, snapshot);

  const { error } = await supabase
    .from("finance_transactions")
    .update({
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
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeFinanceRepositoryError(error));
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
