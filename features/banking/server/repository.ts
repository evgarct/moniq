import "server-only";

import { subDays } from "date-fns";
import { randomUUID } from "node:crypto";

import {
  buildImportFingerprint,
  matchImportRule,
  normalizeMerchant,
  type ImportedProviderTransaction,
} from "@/features/banking/lib/import-rules";
import {
  createEnableBankingSession,
  getEnableBankingAccountDetails,
  getEnableBankingAccountTransactions,
  getEnableBankingDefaults,
  getEnableBankingSession,
  startEnableBankingAuthorization,
} from "@/features/banking/server/enable-banking";
import { createTransaction, getFinanceSnapshot } from "@/features/finance/server/repository";
import { createClient } from "@/lib/supabase/server";
import type { BankingAccount, BankingConnection, BankingRule, BankingSnapshot, BankingTransaction } from "@/types/banking";
import type { Category, Transaction } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";

type BankingConnectionRow = BankingConnection;
type BankingAccountRow = BankingAccount;
type BankingRuleRow = Omit<BankingRule, "category">;
type BankingTransactionRow = Omit<BankingTransaction, "category" | "banking_account" | "finance_transaction">;

type BankingTransactionUpdateInput = {
  merchant_clean?: string;
  category_id?: string | null;
};

function mapRule(row: BankingRuleRow, categoriesById: Map<string, Category>): BankingRule {
  return {
    ...row,
    category: categoriesById.get(row.category_id) ?? null,
  };
}

function mapBankingTransaction(
  row: BankingTransactionRow,
  options: {
    categoriesById: Map<string, Category>;
    bankingAccountsById: Map<string, BankingAccount>;
    financeTransactionsById: Map<string, Transaction>;
  },
): BankingTransaction {
  return {
    ...row,
    amount: Number(row.amount),
    category: row.category_id ? options.categoriesById.get(row.category_id) ?? null : null,
    banking_account: options.bankingAccountsById.get(row.banking_account_id) ?? null,
    finance_transaction: row.finance_transaction_id
      ? options.financeTransactionsById.get(row.finance_transaction_id) ?? null
      : null,
  };
}

function normalizeBankingRepositoryError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "Unable to load banking data.";

  if (
    message.includes("enable_banking_") ||
    message.includes("provider_account_id") ||
    message.includes("fingerprint") ||
    message.includes("wallet_id")
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
    categoriesById: new Map(snapshot.categories.map((category) => [category.id, category])),
    financeTransactionsById: new Map(snapshot.transactions.map((transaction) => [transaction.id, transaction])),
  };
}

async function ensureWalletForBankingAccount(
  bankingAccount: Pick<BankingAccount, "id" | "name" | "currency" | "wallet_id">,
  userId: string,
) {
  const { supabase } = await getAuthenticatedSupabase();

  if (bankingAccount.wallet_id) {
    return bankingAccount.wallet_id;
  }

  const financeSnapshot = await getFinanceSnapshot();
  const matchedWallet = financeSnapshot.accounts.find(
    (wallet) => wallet.name.toLowerCase() === bankingAccount.name.toLowerCase() && wallet.currency === bankingAccount.currency,
  );

  if (matchedWallet) {
    const { error } = await supabase
      .from("enable_banking_accounts")
      .update({ wallet_id: matchedWallet.id })
      .eq("id", bankingAccount.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(normalizeBankingRepositoryError(error));
    }

    return matchedWallet.id;
  }

  const { data, error } = await supabase
    .from("wallets")
    .insert({
      user_id: userId,
      name: bankingAccount.name,
      type: "cash",
      cash_kind: "debit_card",
      balance: 0,
      currency: bankingAccount.currency,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(normalizeBankingRepositoryError(error));
  }

  const { error: linkError } = await supabase
    .from("enable_banking_accounts")
    .update({ wallet_id: data.id })
    .eq("id", bankingAccount.id)
    .eq("user_id", userId);

  if (linkError) {
    throw new Error(normalizeBankingRepositoryError(linkError));
  }

  return data.id;
}

function toFinanceTransactionInput(transaction: BankingTransaction, walletId: string): TransactionInput {
  const common = {
    title: transaction.merchant_clean.trim() || transaction.merchant_raw.trim(),
    note: `Imported from bank on ${transaction.transaction_date}`,
    occurred_at: transaction.transaction_date,
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
      source_account_id: walletId,
      destination_account_id: null,
    };
  }

  return {
    ...common,
    kind: "income",
    source_account_id: null,
    destination_account_id: walletId,
  };
}

async function createRuleFromConfirmedTransaction(transaction: BankingTransaction) {
  if (!transaction.category_id) {
    return;
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  const pattern = transaction.merchant_clean.trim().toLowerCase();

  if (!pattern) {
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("enable_banking_rules")
    .select("id")
    .eq("user_id", user.id)
    .eq("merchant_pattern", pattern)
    .eq("category_id", transaction.category_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(normalizeBankingRepositoryError(existingError));
  }

  if (existing?.id) {
    return;
  }

  const { error } = await supabase.from("enable_banking_rules").insert({
    user_id: user.id,
    merchant_pattern: pattern,
    category_id: transaction.category_id,
  });

  if (error) {
    throw new Error(normalizeBankingRepositoryError(error));
  }
}

export async function getBankingSnapshot(): Promise<BankingSnapshot> {
  const { supabase, user } = await getAuthenticatedSupabase();
  const [
    { snapshot, categoriesById, financeTransactionsById },
    { data: connectionRow, error: connectionError },
    { data: accountRows, error: accountError },
    { data: ruleRows, error: ruleError },
    { data: transactionRows, error: transactionError },
  ] = await Promise.all([
    getFinanceDependencies(),
    supabase
      .from("enable_banking_connections")
      .select("id, user_id, provider, aspsp_name, session_id, state, redirect_url, status, last_error, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("enable_banking_accounts")
      .select("id, user_id, connection_id, wallet_id, provider_account_id, name, currency, iban, institution_name, last_sync_date, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("enable_banking_rules")
      .select("id, user_id, merchant_pattern, category_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("enable_banking_transactions")
      .select("id, user_id, connection_id, banking_account_id, finance_transaction_id, external_id, fingerprint, amount, currency, transaction_date, merchant_raw, merchant_clean, category_id, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (connectionError) {
    throw new Error(normalizeBankingRepositoryError(connectionError));
  }

  if (accountError) {
    throw new Error(normalizeBankingRepositoryError(accountError));
  }

  if (ruleError) {
    throw new Error(normalizeBankingRepositoryError(ruleError));
  }

  if (transactionError) {
    throw new Error(normalizeBankingRepositoryError(transactionError));
  }

  const accounts = (accountRows ?? []) as BankingAccountRow[];
  const bankingAccountsById = new Map(accounts.map((account) => [account.id, account]));
  const rules = (ruleRows ?? []).map((row) => mapRule(row as BankingRuleRow, categoriesById));
  const transactions = (transactionRows ?? []).map((row) =>
    mapBankingTransaction(row as BankingTransactionRow, {
      categoriesById,
      bankingAccountsById,
      financeTransactionsById,
    }),
  );

  return {
    connection: (connectionRow as BankingConnectionRow | null) ?? null,
    accounts,
    rules,
    categories: snapshot.categories,
    draftTransactions: transactions.filter((transaction) => transaction.status === "draft"),
    confirmedTransactions: transactions.filter((transaction) => transaction.status !== "draft"),
  };
}

export async function connectBank(input?: { redirectUrl?: string; aspspName?: string; aspspCountry?: string }) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const defaults = await getEnableBankingDefaults();
  const state = randomUUID();
  const redirectUrl = input?.redirectUrl?.trim() || defaults.redirectUrl;
  const aspspName = input?.aspspName?.trim() || defaults.aspspName;
  const aspspCountry = input?.aspspCountry?.trim() || defaults.aspspCountry;

  const { data: connectionRow, error: insertError } = await supabase
    .from("enable_banking_connections")
    .insert({
      user_id: user.id,
      aspsp_name: aspspName,
      state,
      redirect_url: redirectUrl,
      status: "pending",
      last_error: null,
    })
    .select("id")
    .single();

  if (insertError || !connectionRow?.id) {
    throw new Error(normalizeBankingRepositoryError(insertError));
  }

  try {
    const authorization = await startEnableBankingAuthorization({
      access: { accounts: ["balances", "transactions"] },
      aspsp: {
        name: aspspName,
        ...(aspspCountry ? { country: aspspCountry } : {}),
      },
      state,
      redirect_url: redirectUrl,
      psu_type: "personal",
    });

    return {
      redirectUrl: authorization.redirectUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect a bank.";
    await supabase
      .from("enable_banking_connections")
      .update({ status: "error", last_error: message })
      .eq("id", connectionRow.id)
      .eq("user_id", user.id);
    throw error;
  }
}

export async function finalizeBankConnection(code: string, state: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { data: connectionRow, error: connectionError } = await supabase
    .from("enable_banking_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("state", state)
    .maybeSingle();

  if (connectionError) {
    throw new Error(normalizeBankingRepositoryError(connectionError));
  }

  if (!connectionRow?.id) {
    throw new Error("Bank connection state is invalid.");
  }

  const session = await createEnableBankingSession(code);

  const { error: updateError } = await supabase
    .from("enable_banking_connections")
    .update({
      session_id: session.session_id,
      status: "connected",
      last_error: null,
    })
    .eq("id", connectionRow.id)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(normalizeBankingRepositoryError(updateError));
  }
}

export async function syncBankTransactions() {
  const { supabase, user } = await getAuthenticatedSupabase();
  const snapshot = await getBankingSnapshot();

  if (!snapshot.connection?.session_id) {
    throw new Error("Bank session is not connected.");
  }

  const session = await getEnableBankingSession(snapshot.connection.session_id);
  const providerAccountIds = session.accounts ?? session.accounts_data?.map((account) => account.uid ?? "").filter(Boolean) ?? [];

  if (!providerAccountIds.length) {
    return getBankingSnapshot();
  }

  const finance = await getFinanceSnapshot();
  const categories = finance.categories;
  const rules = snapshot.rules.map((rule) => ({
    merchant_pattern: rule.merchant_pattern,
    category_id: rule.category_id,
  }));
  const existingAccountsByProviderId = new Map(snapshot.accounts.map((account) => [account.provider_account_id, account]));
  const lookbackDate = subDays(new Date(), 30).toISOString().slice(0, 10);

  for (const providerAccountId of providerAccountIds) {
    const [details, transactionsResponse] = await Promise.all([
      getEnableBankingAccountDetails(providerAccountId),
      getEnableBankingAccountTransactions(providerAccountId, lookbackDate),
    ]);

    const accountName = details.name?.trim() || details.details?.trim() || `Bank account ${providerAccountId.slice(0, 6)}`;
    const currency = details.currency?.trim() || "EUR";
    const iban = details.account_id?.iban ?? details.account_id?.other?.identification ?? null;
    const existingAccount = existingAccountsByProviderId.get(providerAccountId);

    const { data: accountRow, error: accountError } = await supabase
      .from("enable_banking_accounts")
      .upsert(
        {
          user_id: user.id,
          connection_id: snapshot.connection.id,
          wallet_id: existingAccount?.wallet_id ?? null,
          provider_account_id: providerAccountId,
          name: accountName,
          currency,
          iban,
          institution_name: session.aspsp?.name ?? snapshot.connection.aspsp_name,
          last_sync_date: new Date().toISOString(),
        },
        { onConflict: "user_id,provider_account_id" },
      )
      .select("id, user_id, connection_id, wallet_id, provider_account_id, name, currency, iban, institution_name, last_sync_date, created_at, updated_at")
      .single();

    if (accountError || !accountRow) {
      throw new Error(normalizeBankingRepositoryError(accountError));
    }

    const bankingAccount = accountRow as BankingAccountRow;
    existingAccountsByProviderId.set(providerAccountId, bankingAccount);
    await ensureWalletForBankingAccount(bankingAccount, user.id);

    const providerTransactions = (transactionsResponse.transactions ?? []).map<ImportedProviderTransaction>((transaction) => {
      const amount = Number(transaction.transaction_amount?.amount ?? 0);
      const signedAmount = transaction.credit_debit_indicator === "DBIT" ? -Math.abs(amount) : Math.abs(amount);
      const merchant =
        transaction.credit_debit_indicator === "DBIT"
          ? transaction.creditor?.name ?? transaction.note ?? transaction.remittance_information?.[0] ?? "Card payment"
          : transaction.debtor?.name ?? transaction.note ?? transaction.remittance_information?.[0] ?? "Incoming transfer";

      return {
        accountId: providerAccountId,
        transactionId: transaction.transaction_id ?? transaction.entry_reference ?? null,
        amount: signedAmount,
        currency: transaction.transaction_amount?.currency ?? currency,
        date: transaction.booking_date ?? transaction.transaction_date ?? transaction.value_date ?? new Date().toISOString().slice(0, 10),
        merchant,
      };
    });

    for (const providerTransaction of providerTransactions) {
      const merchantClean = normalizeMerchant(providerTransaction.merchant);
      const matchedCategory = matchImportRule(merchantClean, rules, categories);
      const fingerprint = buildImportFingerprint(providerTransaction);
      const transactionId = providerTransaction.transactionId?.replaceAll(",", "-");

      const { data: existingTransaction, error: existingError } = await supabase
        .from("enable_banking_transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("banking_account_id", bankingAccount.id)
        .or(transactionId ? `external_id.eq.${transactionId},fingerprint.eq.${fingerprint}` : `fingerprint.eq.${fingerprint}`)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new Error(normalizeBankingRepositoryError(existingError));
      }

      if (existingTransaction?.id) {
        continue;
      }

      const { error: insertError } = await supabase.from("enable_banking_transactions").insert({
        user_id: user.id,
        connection_id: snapshot.connection.id,
        banking_account_id: bankingAccount.id,
        external_id: transactionId ?? null,
        fingerprint,
        amount: providerTransaction.amount,
        currency: providerTransaction.currency,
        transaction_date: providerTransaction.date,
        merchant_raw: providerTransaction.merchant,
        merchant_clean: merchantClean,
        category_id: matchedCategory?.id ?? null,
        status: "draft",
      });

      if (insertError) {
        throw new Error(normalizeBankingRepositoryError(insertError));
      }
    }
  }

  return getBankingSnapshot();
}

export async function updateBankingTransaction(transactionId: string, values: BankingTransactionUpdateInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const nextValues = {
    ...(typeof values.merchant_clean === "string" ? { merchant_clean: normalizeMerchant(values.merchant_clean) } : {}),
    ...(values.category_id !== undefined ? { category_id: values.category_id } : {}),
  };

  const { error } = await supabase
    .from("enable_banking_transactions")
    .update(nextValues)
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeBankingRepositoryError(error));
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

  if (!target.banking_account) {
    throw new Error("Imported bank account not found.");
  }

  const walletId = await ensureWalletForBankingAccount(target.banking_account, user.id);
  const financeInput = toFinanceTransactionInput(target, walletId);
  await createTransaction(financeInput);

  const financeSnapshot = await getFinanceSnapshot();
  const createdFinanceTransaction = financeSnapshot.transactions.find(
    (transaction) =>
      transaction.title === financeInput.title &&
      transaction.occurred_at === financeInput.occurred_at &&
      transaction.amount === financeInput.amount,
  );

  const { error } = await supabase
    .from("enable_banking_transactions")
    .update({
      finance_transaction_id: createdFinanceTransaction?.id ?? null,
      status: target.merchant_clean === normalizeMerchant(target.merchant_raw) ? "confirmed" : "edited",
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(normalizeBankingRepositoryError(error));
  }

  await createRuleFromConfirmedTransaction(target);
}

export async function batchConfirmBankingTransactions(transactionIds: string[]) {
  for (const transactionId of transactionIds) {
    await confirmSingleBankingTransaction(transactionId);
  }

  return getBankingSnapshot();
}
