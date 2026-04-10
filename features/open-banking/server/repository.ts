import { createClient } from "@/lib/supabase/server";
import {
  createRequisition,
  getAccountDetails,
  getAccountTransactions,
  getRequisition,
  type GoCardlessTransaction,
} from "@/lib/gocardless";
import { normalizeMerchant } from "@/features/open-banking/lib/merchant-normalizer";

type DraftStatus = "draft" | "confirmed" | "edited";

function resolveMerchant(transaction: GoCardlessTransaction) {
  return (
    transaction.creditorName ??
    transaction.debtorName ??
    transaction.remittanceInformationUnstructured ??
    "UNKNOWN"
  );
}

export async function connectBank() {
  return createRequisition();
}

export async function importAccountsFromRequisition(requisitionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const requisition = await getRequisition(requisitionId);
  const insertedAccounts: Array<{ id: string; name: string }> = [];

  for (const providerAccountId of requisition.accounts) {
    const details = await getAccountDetails(providerAccountId);
    const accountName = details.account.name ?? details.account.iban ?? `Account ${providerAccountId.slice(0, 6)}`;

    const { data, error } = await supabase
      .from("bank_accounts")
      .upsert(
        {
          user_id: user.id,
          requisition_id: requisition.id,
          provider_account_id: providerAccountId,
          name: accountName,
          iban: details.account.iban ?? null,
          currency: details.account.currency ?? null,
        },
        { onConflict: "user_id,provider_account_id" },
      )
      .select("id,name")
      .single();

    if (error) {
      throw error;
    }

    insertedAccounts.push(data);
  }

  return insertedAccounts;
}

export async function getAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bank_accounts").select("id,name,provider_account_id,last_sync_date,currency").order("name");

  if (error) {
    throw error;
  }

  return data;
}

async function resolveCategoryFromRules(userId: string, merchantRaw: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bank_rules").select("merchant_pattern,category").eq("user_id", userId);

  if (error) {
    throw error;
  }

  const lowerRaw = merchantRaw.toLowerCase();
  const match = data.find((rule) => lowerRaw.includes(rule.merchant_pattern.toLowerCase()));
  return match?.category ?? null;
}

export async function syncTransactions(accountId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  let query = supabase.from("bank_accounts").select("id,provider_account_id,last_sync_date,user_id");
  if (accountId) {
    query = query.eq("id", accountId);
  }

  const { data: accounts, error: accountError } = await query;
  if (accountError) {
    throw accountError;
  }

  let inserted = 0;

  for (const account of accounts) {
    const txResponse = await getAccountTransactions(account.provider_account_id, account.last_sync_date ?? undefined);
    const transactions = [...(txResponse.transactions.booked ?? []), ...(txResponse.transactions.pending ?? [])];

    for (const transaction of transactions) {
      const merchantRaw = resolveMerchant(transaction);
      const amount = Number(transaction.transactionAmount.amount);
      const category = await resolveCategoryFromRules(user.id, merchantRaw);

      const { error } = await supabase.from("bank_transactions").upsert(
        {
          user_id: user.id,
          account_id: account.id,
          provider_transaction_id: transaction.transactionId ?? null,
          amount,
          currency: transaction.transactionAmount.currency,
          date: transaction.bookingDate,
          merchant_raw: merchantRaw,
          merchant_clean: normalizeMerchant(merchantRaw),
          category,
          status: "draft",
        },
        { onConflict: transaction.transactionId ? "user_id,provider_transaction_id" : "user_id,account_id,amount,date,merchant_raw" },
      );

      if (!error) {
        inserted += 1;
      }
    }

    await supabase.from("bank_accounts").update({ last_sync_date: new Date().toISOString().slice(0, 10) }).eq("id", account.id);
  }

  return { inserted };
}

export async function getTransactions(status: DraftStatus) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("id,amount,currency,date,merchant_raw,merchant_clean,category,status,account_id")
    .eq("status", status)
    .order("date", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTransaction(
  transactionId: string,
  payload: { merchant_clean?: string; category?: string; status?: DraftStatus },
) {
  const supabase = await createClient();

  const nextPayload = {
    merchant_clean: payload.merchant_clean,
    category: payload.category,
    status: payload.status,
  };

  const { data: current, error: currentError } = await supabase
    .from("bank_transactions")
    .select("id,merchant_raw,category")
    .eq("id", transactionId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const { data: updated, error } = await supabase
    .from("bank_transactions")
    .update(nextPayload)
    .eq("id", transactionId)
    .select("id,merchant_raw,category")
    .single();

  if (error) {
    throw error;
  }

  if (payload.category && payload.category !== current.category) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("bank_rules").upsert(
        {
          user_id: user.id,
          merchant_pattern: normalizeMerchant(updated.merchant_raw).toLowerCase(),
          category: payload.category,
        },
        { onConflict: "user_id,merchant_pattern" },
      );
    }
  }

  return updated;
}

export async function batchConfirm(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").update({ status: "confirmed" }).in("id", ids);

  if (error) {
    throw error;
  }

  return { updated: ids.length };
}
