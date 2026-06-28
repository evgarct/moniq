import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { assertStagingTarget, loadEnvFiles, requiredEnv } from "./staging-env.mjs";

loadEnvFiles();

const stagingRef = requiredEnv("SUPABASE_STAGING_PROJECT_REF");
const productionRef = requiredEnv("SUPABASE_PRODUCTION_PROJECT_REF");
const url = requiredEnv("STAGING_SUPABASE_URL");
const serviceRoleKey = requiredEnv("STAGING_SUPABASE_SERVICE_ROLE_KEY");
const password = requiredEnv("MONIQ_STAGING_PASSWORD");
const emailDomain = process.env.MONIQ_STAGING_EMAIL_DOMAIN?.trim() || "example.invalid";
const emailPrefix = process.env.MONIQ_STAGING_EMAIL_PREFIX?.trim() || "moniq.codex";

assertStagingTarget(url, stagingRef, productionRef);

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const personas = ["empty", "standard", "heavy", "conflict"];

async function findUser(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error("Unable to scan staging auth users.");
}

async function ensureUser(persona) {
  const email = `${emailPrefix}.${persona}@${emailDomain}`.toLowerCase();
  const existing = await findUser(email);
  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "moniq-staging", persona },
    app_metadata: { moniq_staging: true, persona },
  };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser(attributes);
  if (error) throw error;
  return data.user;
}

async function deleteOwned(table, userId) {
  const { error } = await supabase.from(table).delete().eq("user_id", userId);
  if (error && error.code !== "PGRST205") throw new Error(`${table}: ${error.message}`);
}

async function resetUser(userId) {
  for (const table of [
    "finance_sync_mutations",
    "investment_positions",
    "transaction_import_column_presets",
    "transaction_imports",
    "transaction_import_rules",
    "transaction_import_batches",
    "finance_transactions",
    "finance_transaction_schedules",
    "finance_categories",
    "wallet_allocations",
    "wallets",
    "user_preferences",
    "user_billing_entitlements",
  ]) {
    await deleteOwned(table, userId);
  }
}

async function seedEntitlement(userId) {
  const { error } = await supabase.from("user_billing_entitlements").upsert({
    user_id: userId,
    subscription_status: "active",
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    access_override: null,
  });
  if (error) throw error;
}

function dateAt(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function seedFinance(userId, persona) {
  const cashId = randomUUID();
  const savingsId = randomUUID();
  const creditId = randomUUID();
  const incomeId = randomUUID();
  const expenseId = randomUUID();
  const salaryId = randomUUID();
  const groceriesId = randomUUID();

  let result = await supabase.from("wallets").insert([
    { id: cashId, user_id: userId, name: "Everyday EUR", type: "cash", cash_kind: "debit_card", balance: 3200, currency: "EUR" },
    { id: savingsId, user_id: userId, name: "Reserve EUR", type: "saving", balance: 5600, currency: "EUR" },
    { id: creditId, user_id: userId, name: "Credit CZK", type: "credit_card", balance: -4200, credit_limit: 60000, currency: "CZK" },
  ]);
  if (result.error) throw result.error;

  result = await supabase.from("finance_categories").insert([
    { id: incomeId, user_id: userId, name: "Income", icon: "banknote-arrow-up", type: "income" },
    { id: expenseId, user_id: userId, name: "Living", icon: "home", type: "expense" },
    { id: salaryId, user_id: userId, name: "Salary", icon: "briefcase-business", type: "income", parent_id: incomeId },
    { id: groceriesId, user_id: userId, name: "Groceries", icon: "shopping-basket", type: "expense", parent_id: expenseId },
  ]);
  if (result.error) throw result.error;

  result = await supabase.from("wallet_allocations").insert({
    id: randomUUID(), user_id: userId, wallet_id: savingsId, name: "Emergency fund", kind: "goal_targeted", amount: 1750, target_amount: 5000,
  });
  if (result.error) throw result.error;

  result = await supabase.from("user_preferences").upsert({ user_id: userId, default_currency: "EUR" });
  if (result.error) throw result.error;

  const baseTransactions = [
    { id: randomUUID(), user_id: userId, title: "Monthly salary", occurred_at: dateAt(-8), status: "paid", kind: "income", amount: 4200, category_id: salaryId, destination_account_id: cashId },
    { id: randomUUID(), user_id: userId, title: "Grocery run", occurred_at: dateAt(-2), status: "paid", kind: "expense", amount: 86.45, category_id: groceriesId, source_account_id: cashId },
    { id: randomUUID(), user_id: userId, title: "Savings transfer", occurred_at: dateAt(-1), status: "paid", kind: "transfer", amount: 250, destination_amount: 250, source_account_id: cashId, destination_account_id: savingsId },
  ];
  result = await supabase.from("finance_transactions").insert(baseTransactions);
  if (result.error) throw result.error;

  result = await supabase.from("finance_transaction_schedules").insert({
    id: randomUUID(), user_id: userId, title: "Monthly groceries", start_date: dateAt(2), frequency: "monthly", interval_weeks: 1, state: "active", kind: "expense", amount: 120, category_id: groceriesId, source_account_id: cashId,
  });
  if (result.error) throw result.error;

  if (persona === "heavy") {
    const rows = Array.from({ length: 1500 }, (_, index) => ({
      id: randomUUID(),
      user_id: userId,
      title: `Performance transaction ${index + 1}`,
      occurred_at: dateAt(-(index % 365)),
      status: "paid",
      kind: "expense",
      amount: ((index % 97) + 1) / 3,
      category_id: groceriesId,
      source_account_id: cashId,
    }));
    for (let index = 0; index < rows.length; index += 250) {
      const { error } = await supabase.from("finance_transactions").insert(rows.slice(index, index + 250));
      if (error) throw error;
    }
  }
}

for (const persona of personas) {
  const user = await ensureUser(persona);
  await resetUser(user.id);
  await seedEntitlement(user.id);
  if (persona !== "empty") await seedFinance(user.id, persona);
  console.log(`Staging persona ready: ${persona} (${user.email})`);
}
