import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/types/currency";
import type { AllocationInput, WalletInput } from "@/types/finance-schemas";
import type { Account, Allocation, FinanceSnapshot } from "@/types/finance";

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

  const [{ data: wallets, error: walletError }, { data: allocations, error: allocationError }] = await Promise.all([
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
  ]);

  if (walletError) {
    throw new Error(walletError.message);
  }

  if (allocationError) {
    throw new Error(allocationError.message);
  }

  return {
    accounts: (wallets ?? []).map((wallet) => mapWallet(wallet as WalletRow)),
    allocations: (allocations ?? []).map((allocation) => mapAllocation(allocation as WalletAllocationRow)),
    categories: [],
    transactions: [],
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
    throw new Error(error.message);
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
    throw new Error(error.message);
  }
}

export async function deleteWallet(walletId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("delete_wallet", {
    _wallet_id: walletId,
  });

  if (error) {
    throw new Error(error.message);
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
    throw new Error(error.message);
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
    throw new Error(error.message);
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
