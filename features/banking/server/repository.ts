import "server-only";

import {
  buildImportFingerprint,
  matchImportRule,
  normalizeMerchant,
} from "@/features/banking/lib/import-rules";
import { parseCsvTransactions } from "@/features/banking/lib/csv-import";
import { createTransaction, getFinanceSnapshot } from "@/features/finance/server/repository";
import { createClient } from "@/lib/supabase/server";
import type {
  TransactionImport,
  TransactionImportBatch,
  TransactionImportRule,
  TransactionImportSnapshot,
} from "@/types/imports";
import type { Account, Category, Transaction } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";

type TransactionImportBatchRow = Omit<TransactionImportBatch, "wallet">;
type TransactionImportRuleRow = Omit<TransactionImportRule, "category">;
type TransactionImportRow = Omit<TransactionImport, "batch" | "wallet" | "category" | "finance_transaction">;

type TransactionImportUpdateInput = {
  merchant_clean?: string;
  category_id?: string | null;
};

function mapRule(row: TransactionImportRuleRow, categoriesById: Map<string, Category>): TransactionImportRule {
  return {
    ...row,
    category: categoriesById.get(row.category_id) ?? null,
  };
}

function mapBatch(row: TransactionImportBatchRow, walletsById: Map<string, Account>): TransactionImportBatch {
  return {
    ...row,
    wallet: walletsById.get(row.wallet_id) ?? null,
  };
}

function mapImportedTransaction(
  row: TransactionImportRow,
  options: {
    batchesById: Map<string, TransactionImportBatch>;
    walletsById: Map<string, Account>;
    categoriesById: Map<string, Category>;
    financeTransactionsById: Map<string, Transaction>;
  },
): TransactionImport {
  return {
    ...row,
    amount: Number(row.amount),
    batch: options.batchesById.get(row.batch_id) ?? null,
    wallet: options.walletsById.get(row.wallet_id) ?? null,
    category: row.category_id ? options.categoriesById.get(row.category_id) ?? null : null,
    finance_transaction: row.finance_transaction_id
      ? options.financeTransactionsById.get(row.finance_transaction_id) ?? null
      : null,
  };
}

function normalizeImportRepositoryError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "Unable to load imported transactions.";

  if (
    message.includes("transaction_import") ||
    message.includes("wallet_id") ||
    message.includes("fingerprint") ||
    message.includes("imported_rows")
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

async function getFinanceDependencies() {
  const snapshot = await getFinanceSnapshot();
  return {
    snapshot,
    walletsById: new Map(snapshot.accounts.map((wallet) => [wallet.id, wallet])),
    categoriesById: new Map(snapshot.categories.map((category) => [category.id, category])),
    financeTransactionsById: new Map(snapshot.transactions.map((transaction) => [transaction.id, transaction])),
  };
}

function toFinanceTransactionInput(transaction: TransactionImport): TransactionInput {
  const common = {
    title: transaction.merchant_clean.trim() || transaction.merchant_raw.trim(),
    note: `Imported from CSV file${transaction.batch?.file_name ? ` (${transaction.batch.file_name})` : ""}`,
    occurred_at: transaction.occurred_at,
    status: "paid" as const,
    amount: Math.abs(transaction.amount),
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: transaction.category_id ?? null,
    allocation_id: null,
  };

  if (transaction.amount < 0) {
    return {
      ...common,
      kind: "expense",
      source_account_id: transaction.wallet_id,
      destination_account_id: null,
    };
  }

  return {
    ...common,
    kind: "income",
    source_account_id: null,
    destination_account_id: transaction.wallet_id,
  };
}

async function createRuleFromConfirmedTransaction(transaction: TransactionImport) {
  if (!transaction.category_id) {
    return;
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  const pattern = transaction.merchant_clean.trim().toLowerCase();

  if (!pattern) {
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("transaction_import_rules")
    .select("id")
    .eq("user_id", user.id)
    .eq("merchant_pattern", pattern)
    .eq("category_id", transaction.category_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(normalizeImportRepositoryError(existingError));
  }

  if (existing?.id) {
    return;
  }

  const { error } = await supabase.from("transaction_import_rules").insert({
    user_id: user.id,
    merchant_pattern: pattern,
    category_id: transaction.category_id,
  });

  if (error) {
    throw new Error(normalizeImportRepositoryError(error));
  }
}

export async function getBankingSnapshot(): Promise<TransactionImportSnapshot> {
  const { supabase, user } = await getAuthenticatedSupabase();
  const [
    { snapshot, walletsById, categoriesById, financeTransactionsById },
    { data: batchRows, error: batchError },
    { data: ruleRows, error: ruleError },
    { data: importRows, error: importError },
  ] = await Promise.all([
    getFinanceDependencies(),
    supabase
      .from("transaction_import_batches")
      .select("id, user_id, wallet_id, source, file_name, imported_rows, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("transaction_import_rules")
      .select("id, user_id, merchant_pattern, category_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction_imports")
      .select(
        "id, user_id, batch_id, wallet_id, finance_transaction_id, external_id, row_index, fingerprint, amount, currency, occurred_at, merchant_raw, merchant_clean, category_id, status, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (batchError) {
    throw new Error(normalizeImportRepositoryError(batchError));
  }

  if (ruleError) {
    throw new Error(normalizeImportRepositoryError(ruleError));
  }

  if (importError) {
    throw new Error(normalizeImportRepositoryError(importError));
  }

  const batches = (batchRows ?? []).map((row) => mapBatch(row as TransactionImportBatchRow, walletsById));
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const rules = (ruleRows ?? []).map((row) => mapRule(row as TransactionImportRuleRow, categoriesById));
  const imports = (importRows ?? []).map((row) =>
    mapImportedTransaction(row as TransactionImportRow, {
      batchesById,
      walletsById,
      categoriesById,
      financeTransactionsById,
    }),
  );

  return {
    batches,
    rules,
    wallets: snapshot.accounts,
    categories: snapshot.categories,
    draftTransactions: imports.filter((transaction) => transaction.status === "draft"),
    confirmedTransactions: imports.filter((transaction) => transaction.status !== "draft"),
  };
}

export async function uploadCsvImport(input: {
  walletId: string;
  fileName: string;
  csvText: string;
}) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const finance = await getFinanceSnapshot();
  const wallet = finance.accounts.find((account) => account.id === input.walletId);

  if (!wallet) {
    throw new Error("Wallet not found.");
  }

  const { data: ruleRows, error: ruleError } = await supabase
    .from("transaction_import_rules")
    .select("merchant_pattern, category_id")
    .eq("user_id", user.id);

  if (ruleError) {
    throw new Error(normalizeImportRepositoryError(ruleError));
  }

  const parsedRows = parseCsvTransactions({
    csvText: input.csvText,
    walletId: wallet.id,
    fallbackCurrency: wallet.currency,
  });

  if (!parsedRows.length) {
    throw new Error("CSV file did not contain recognizable transaction rows.");
  }

  const { data: batchRow, error: batchError } = await supabase
    .from("transaction_import_batches")
    .insert({
      user_id: user.id,
      wallet_id: wallet.id,
      source: "csv",
      file_name: input.fileName.trim() || "import.csv",
      imported_rows: 0,
    })
    .select("id, user_id, wallet_id, source, file_name, imported_rows, created_at")
    .single();

  if (batchError || !batchRow) {
    throw new Error(normalizeImportRepositoryError(batchError));
  }

  let insertedRows = 0;

  for (const row of parsedRows) {
    const merchantClean = normalizeMerchant(row.merchant);
    const matchedCategory = matchImportRule(merchantClean, ruleRows ?? [], finance.categories);
    const fingerprint = buildImportFingerprint(row);
    const externalId = row.transactionId?.replaceAll(",", "-") ?? null;

    const { data: existingImport, error: existingError } = await supabase
      .from("transaction_imports")
      .select("id")
      .eq("user_id", user.id)
      .eq("wallet_id", wallet.id)
      .or(externalId ? `external_id.eq.${externalId},fingerprint.eq.${fingerprint}` : `fingerprint.eq.${fingerprint}`)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(normalizeImportRepositoryError(existingError));
    }

    if (existingImport?.id) {
      continue;
    }

    const { error: insertError } = await supabase.from("transaction_imports").insert({
      user_id: user.id,
      batch_id: batchRow.id,
      wallet_id: wallet.id,
      external_id: externalId,
      row_index: row.rowIndex,
      fingerprint,
      amount: row.amount,
      currency: row.currency,
      occurred_at: row.date,
      merchant_raw: row.merchant,
      merchant_clean: merchantClean,
      category_id: matchedCategory?.id ?? null,
      status: "draft",
    });

    if (insertError) {
      throw new Error(normalizeImportRepositoryError(insertError));
    }

    insertedRows += 1;
  }

  const { error: updateBatchError } = await supabase
    .from("transaction_import_batches")
    .update({ imported_rows: insertedRows })
    .eq("id", batchRow.id)
    .eq("user_id", user.id);

  if (updateBatchError) {
    throw new Error(normalizeImportRepositoryError(updateBatchError));
  }

  return getBankingSnapshot();
}

export async function updateBankingTransaction(transactionId: string, values: TransactionImportUpdateInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const nextValues = {
    ...(typeof values.merchant_clean === "string" ? { merchant_clean: normalizeMerchant(values.merchant_clean) } : {}),
    ...(values.category_id !== undefined ? { category_id: values.category_id } : {}),
  };

  const { error } = await supabase
    .from("transaction_imports")
    .update(nextValues)
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeImportRepositoryError(error));
  }
}

async function confirmSingleBankingTransaction(transactionId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getBankingSnapshot();
  const target =
    snapshot.draftTransactions.find((transaction) => transaction.id === transactionId) ??
    snapshot.confirmedTransactions.find((transaction) => transaction.id === transactionId);

  if (!target) {
    throw new Error("Imported transaction not found.");
  }

  if (!target.wallet) {
    throw new Error("Wallet not found.");
  }

  const financeInput = toFinanceTransactionInput(target);
  await createTransaction(financeInput);

  const financeSnapshot = await getFinanceSnapshot();
  const createdFinanceTransaction = financeSnapshot.transactions.find(
    (transaction) =>
      transaction.title === financeInput.title &&
      transaction.occurred_at === financeInput.occurred_at &&
      transaction.amount === financeInput.amount,
  );

  const { error } = await supabase
    .from("transaction_imports")
    .update({
      finance_transaction_id: createdFinanceTransaction?.id ?? null,
      status: target.merchant_clean === normalizeMerchant(target.merchant_raw) ? "confirmed" : "edited",
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeImportRepositoryError(error));
  }

  await createRuleFromConfirmedTransaction(target);
}

export async function batchConfirmBankingTransactions(transactionIds: string[]) {
  for (const transactionId of transactionIds) {
    await confirmSingleBankingTransaction(transactionId);
  }

  return getBankingSnapshot();
}
