import "server-only";

import {
  buildImportFingerprint,
  matchImportRule,
  normalizeMerchant,
} from "@/features/banking/lib/import-rules";
import {
  buildImportFilePreview,
  canImportWithMapping,
  parseMappedTransactions,
  suggestColumnMapping,
} from "@/features/banking/lib/csv-import";
import { createTransaction, getFinanceSnapshot } from "@/features/finance/server/repository";
import { createClient } from "@/lib/supabase/server";
import type {
  ImportColumnMapping,
  ImportFilePreview,
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
  kind?: "expense" | "income" | "transfer" | "debt_payment";
  wallet_id?: string;
  counterpart_wallet_id?: string | null;
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
    counterpart_wallet: row.counterpart_wallet_id ? options.walletsById.get(row.counterpart_wallet_id) ?? null : null,
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
  // Merchant name (restaurant, store, taxi service, etc.) goes into note so it
  // surfaces as "Category (merchant)" in the transaction list. Title is the
  // category name when available, falling back to merchant as a readable label.
  const merchantLabel = transaction.merchant_clean.trim() || transaction.merchant_raw.trim() || null;
  const categoryLabel = transaction.category?.name?.trim() ?? null;

  const common = {
    title: categoryLabel ?? merchantLabel ?? "—",
    note: merchantLabel,
    occurred_at: transaction.occurred_at,
    status: "paid" as const,
    amount: Math.abs(transaction.amount),
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: transaction.category_id ?? null,
  };

  if (transaction.kind === "transfer") {
    if (!transaction.counterpart_wallet_id) {
      throw new Error("Choose the other wallet for this transfer.");
    }

    const isOutgoing = transaction.amount < 0;

    return {
      ...common,
      // Transfers have no category, so title = merchant already; note would duplicate it.
      note: null,
      kind: "transfer",
      source_account_id: isOutgoing ? transaction.wallet_id : transaction.counterpart_wallet_id,
      destination_account_id: isOutgoing ? transaction.counterpart_wallet_id : transaction.wallet_id,
      destination_amount: Math.abs(transaction.amount),
      category_id: null,
    };
  }

  if (transaction.kind === "debt_payment") {
    if (!transaction.counterpart_wallet_id) {
      throw new Error("Choose the debt account for this payment.");
    }

    return {
      ...common,
      // Debt payments have no category either; title = merchant is self-descriptive.
      note: null,
      kind: "debt_payment",
      source_account_id: transaction.wallet_id,
      destination_account_id: transaction.counterpart_wallet_id,
      principal_amount: Math.abs(transaction.amount),
      interest_amount: 0,
      extra_principal_amount: 0,
      category_id: null,
    };
  }

  if (transaction.kind === "expense" || transaction.amount < 0) {
    if (!transaction.category_id) {
      throw new Error("Choose an expense category before confirming this import.");
    }

    return {
      ...common,
      kind: "expense",
      source_account_id: transaction.wallet_id,
      destination_account_id: null,
    };
  }

  if (!transaction.category_id) {
    throw new Error("Choose an income category before confirming this import.");
  }

  return {
    ...common,
    kind: "income",
    source_account_id: null,
    destination_account_id: transaction.wallet_id,
  };
}

async function createRuleFromConfirmedTransaction(transaction: TransactionImport) {
  if (transaction.kind === "transfer" || !transaction.category_id) {
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
        "id, user_id, batch_id, wallet_id, finance_transaction_id, external_id, row_index, fingerprint, amount, currency, occurred_at, kind, counterpart_wallet_id, merchant_raw, merchant_clean, category_id, status, created_at, updated_at",
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

async function getSavedImportMapping(signature: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("transaction_import_column_presets")
    .select("mapping")
    .eq("user_id", user.id)
    .eq("signature", signature)
    .maybeSingle();

  if (error) {
    throw new Error(normalizeImportRepositoryError(error));
  }

  return (data?.mapping ?? null) as ImportColumnMapping | null;
}

async function saveImportMapping(signature: string, mapping: ImportColumnMapping) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase.from("transaction_import_column_presets").upsert(
    {
      user_id: user.id,
      signature,
      mapping,
    },
    {
      onConflict: "user_id,signature",
    },
  );

  if (error) {
    throw new Error(normalizeImportRepositoryError(error));
  }
}

export async function getImportPreview(input: {
  fileName: string;
  fileBuffer: Uint8Array;
}): Promise<ImportFilePreview> {
  const preview = buildImportFilePreview(input);
  const savedMapping = await getSavedImportMapping(preview.signature);
  const suggestedMapping = savedMapping ?? suggestColumnMapping(preview.columns);

  return {
    ...preview,
    suggestedMapping,
    canImport: canImportWithMapping(suggestedMapping),
  };
}

export async function uploadCsvImport(input: {
  walletId: string;
  fileName: string;
  fileBuffer: Uint8Array;
  mapping: ImportColumnMapping;
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

  const parsedRows = parseMappedTransactions({
    fileName: input.fileName,
    fileBuffer: input.fileBuffer,
    walletId: wallet.id,
    fallbackCurrency: wallet.currency,
    mapping: input.mapping,
  });

  if (!parsedRows.length) {
    throw new Error("CSV file did not contain recognizable transaction rows.");
  }

  await saveImportMapping(buildImportFilePreview({ fileName: input.fileName, fileBuffer: input.fileBuffer }).signature, input.mapping);

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
      kind: row.kind,
      counterpart_wallet_id: null,
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
  const { data: currentImport, error: currentImportError } = await supabase
    .from("transaction_imports")
    .select("id, wallet_id, counterpart_wallet_id, kind")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentImportError) {
    throw new Error(normalizeImportRepositoryError(currentImportError));
  }

  if (!currentImport?.id) {
    throw new Error("Imported transaction not found.");
  }

  const nextValues: Record<string, unknown> = {};
  const nextKind = values.kind ?? currentImport.kind;
  const nextWalletId = values.wallet_id ?? currentImport.wallet_id;
  const nextCounterpartWalletId =
    values.counterpart_wallet_id !== undefined ? values.counterpart_wallet_id : currentImport.counterpart_wallet_id;

  if (typeof values.merchant_clean === "string") {
    nextValues.merchant_clean = normalizeMerchant(values.merchant_clean);
  }

  if (values.wallet_id) {
    nextValues.wallet_id = values.wallet_id;
  }

  if (values.kind) {
    nextValues.kind = values.kind;
    if (values.kind === "transfer" || values.kind === "debt_payment") {
      nextValues.category_id = null;
    }
  }

  if (values.category_id !== undefined && values.kind !== "transfer" && values.kind !== "debt_payment") {
    nextValues.category_id = values.category_id;
  }

  if (values.counterpart_wallet_id !== undefined) {
    nextValues.counterpart_wallet_id = values.counterpart_wallet_id;
  }

  if (
    (nextKind === "transfer" || nextKind === "debt_payment") &&
    nextWalletId &&
    nextCounterpartWalletId &&
    nextWalletId === nextCounterpartWalletId
  ) {
    throw new Error(
      nextKind === "debt_payment"
        ? "Choose a different debt account for this payment."
        : "Choose a different destination wallet for this transfer.",
    );
  }

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

export async function deleteBankingTransaction(transactionId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();

  const { data: importRow, error: importError } = await supabase
    .from("transaction_imports")
    .select("id, status, finance_transaction_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (importError) {
    throw new Error(normalizeImportRepositoryError(importError));
  }

  if (!importRow?.id) {
    throw new Error("Imported transaction not found.");
  }

  if (importRow.status !== "draft" || importRow.finance_transaction_id) {
    throw new Error("Only draft imported transactions can be deleted.");
  }

  const { error: deleteError } = await supabase
    .from("transaction_imports")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(normalizeImportRepositoryError(deleteError));
  }

  return getBankingSnapshot();
}

export async function deleteImportBatch(batchId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();

  const { data: batchRow, error: batchError } = await supabase
    .from("transaction_import_batches")
    .select("id")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (batchError) {
    throw new Error(normalizeImportRepositoryError(batchError));
  }

  if (!batchRow?.id) {
    throw new Error("Import batch not found.");
  }

  const { error: deleteError } = await supabase
    .from("transaction_import_batches")
    .delete()
    .eq("id", batchId)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(normalizeImportRepositoryError(deleteError));
  }

  return getBankingSnapshot();
}
