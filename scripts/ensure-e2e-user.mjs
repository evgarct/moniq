import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (value) return value;
  throw new Error(`Missing ${name}. Add it to .env.local.`);
}

function isMissingTableOrColumn(error) {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("Could not find the") ||
    message.includes("does not exist")
  );
}

async function requireNoError(result, action) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }

  return result.data;
}

async function ignoreMissingSchema(result, action) {
  if (result.error && !isMissingTableOrColumn(result.error)) {
    throw new Error(`${action}: ${result.error.message}`);
  }

  return !result.error;
}

async function findUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`List auth users: ${error.message}`);

    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }

  throw new Error("Unable to find e2e user after scanning the first 2000 auth users.");
}

async function ensureAuthUser(supabase, email, password) {
  const existing = await findUserByEmail(supabase, email);
  const userMetadata = { purpose: "moniq-e2e" };
  const appMetadata = { moniq_e2e: true };

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        ...userMetadata,
      },
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        ...appMetadata,
      },
    });

    if (error) throw new Error(`Update e2e auth user: ${error.message}`);
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  });

  if (error) throw new Error(`Create e2e auth user: ${error.message}`);
  return data.user;
}

async function ensureAuthSession(supabase, email, password) {
  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (!signInResult.error) return signInResult.data.user;
  if (signInResult.error.message.toLowerCase().includes("email not confirmed")) {
    throw new Error(
      "The e2e user exists but its email is not confirmed. " +
        "Confirm it in Supabase Auth or add SUPABASE_SERVICE_ROLE_KEY to .env.local so setup can confirm it automatically.",
    );
  }

  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        purpose: "moniq-e2e",
      },
    },
  });

  if (signUpResult.error) {
    throw new Error(
      `Sign in or create e2e auth user: ${signInResult.error.message}; ${signUpResult.error.message}`,
    );
  }

  const retryResult = await supabase.auth.signInWithPassword({ email, password });
  if (retryResult.error) {
    throw new Error(
      "Created the e2e user, but could not sign in. " +
        "If email confirmations are enabled, confirm the user manually or add SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    );
  }

  return retryResult.data.user;
}

async function resetUserData(supabase, userId) {
  const deletions = [
    ["transaction_import_column_presets", "delete import column presets"],
    ["transaction_imports", "delete import drafts"],
    ["transaction_import_rules", "delete import rules"],
    ["transaction_import_batches", "delete import batches"],
    ["finance_transactions", "delete finance transactions"],
    ["finance_transaction_schedules", "delete finance schedules"],
    ["finance_categories", "delete finance categories"],
    ["wallet_allocations", "delete wallet allocations"],
    ["wallets", "delete wallets"],
  ];

  for (const [table, action] of deletions) {
    await ignoreMissingSchema(
      await supabase.from(table).delete().eq("user_id", userId),
      action,
    );
  }
}

async function seedWallets(supabase, userId) {
  return await requireNoError(
    await supabase
      .from("wallets")
      .insert([
        {
          user_id: userId,
          name: "E2E Everyday Cash",
          type: "cash",
          cash_kind: "debit_card",
          balance: 3200,
          currency: "EUR",
        },
        {
          user_id: userId,
          name: "E2E Savings Vault",
          type: "saving",
          balance: 5600,
          currency: "EUR",
        },
        {
          user_id: userId,
          name: "E2E Credit Card",
          type: "credit_card",
          balance: -420,
          credit_limit: 2500,
          currency: "EUR",
        },
      ])
      .select(),
    "Seed wallets",
  );
}

async function seedAllocation(supabase, userId, savingsWalletId) {
  const allocation = {
    user_id: userId,
    wallet_id: savingsWalletId,
    name: "E2E Emergency Fund",
    kind: "goal_targeted",
    amount: 1750,
    target_amount: 5000,
  };

  const result = await supabase.from("wallet_allocations").insert(allocation).select().single();
  if (!result.error) return result.data;
  if (isMissingTableOrColumn(result.error)) {
    const legacyResult = await supabase
      .from("wallet_allocations")
      .insert({
        user_id: userId,
        wallet_id: savingsWalletId,
        name: allocation.name,
        amount: allocation.amount,
      })
      .select()
      .single();

    if (!legacyResult.error) return legacyResult.data;
    if (isMissingTableOrColumn(legacyResult.error)) {
      console.warn("Skipped wallet allocation seed because wallet_allocations is unavailable in this schema.");
      return null;
    }

    throw new Error(`Seed legacy wallet allocation: ${legacyResult.error.message}`);
  }

  throw new Error(`Seed wallet allocation: ${result.error.message}`);
}

async function seedCategories(supabase, userId) {
  const parentCategories = await requireNoError(
    await supabase
      .from("finance_categories")
      .insert([
        {
          user_id: userId,
          name: "E2E Income",
          icon: "banknote-arrow-up",
          type: "income",
        },
        {
          user_id: userId,
          name: "E2E Living",
          icon: "home",
          type: "expense",
        },
      ])
      .select(),
    "Seed parent categories",
  );

  const income = parentCategories.find((category) => category.type === "income");
  const living = parentCategories.find((category) => category.type === "expense");

  const childCategories = await requireNoError(
    await supabase
      .from("finance_categories")
      .insert([
        {
          user_id: userId,
          name: "E2E Salary",
          icon: "briefcase-business",
          type: "income",
          parent_id: income.id,
        },
        {
          user_id: userId,
          name: "E2E Groceries",
          icon: "shopping-basket",
          type: "expense",
          parent_id: living.id,
        },
        {
          user_id: userId,
          name: "E2E Transport",
          icon: "train",
          type: "expense",
          parent_id: living.id,
        },
      ])
      .select(),
    "Seed child categories",
  );

  return [...parentCategories, ...childCategories];
}

async function seedTransactions(supabase, userId, wallets, categories) {
  const cash = wallets.find((wallet) => wallet.name === "E2E Everyday Cash");
  const savings = wallets.find((wallet) => wallet.name === "E2E Savings Vault");
  const creditCard = wallets.find((wallet) => wallet.name === "E2E Credit Card");
  const salary = categories.find((category) => category.name === "E2E Salary");
  const groceries = categories.find((category) => category.name === "E2E Groceries");
  const transport = categories.find((category) => category.name === "E2E Transport");

  const today = new Date();
  const isoDate = (daysOffset) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + daysOffset);
    return date.toISOString().slice(0, 10);
  };

  await requireNoError(
    await supabase.from("finance_transactions").insert([
      {
        user_id: userId,
        title: "E2E Monthly Salary",
        occurred_at: isoDate(-8),
        status: "paid",
        kind: "income",
        amount: 4200,
        category_id: salary.id,
        destination_account_id: cash.id,
      },
      {
        user_id: userId,
        title: "E2E Grocery Run",
        occurred_at: isoDate(-2),
        status: "paid",
        kind: "expense",
        amount: 86.45,
        category_id: groceries.id,
        source_account_id: cash.id,
      },
      {
        user_id: userId,
        title: "E2E Metro Pass",
        occurred_at: isoDate(1),
        status: "planned",
        kind: "expense",
        amount: 28,
        category_id: transport.id,
        source_account_id: creditCard.id,
      },
      {
        user_id: userId,
        title: "E2E Savings Transfer",
        occurred_at: isoDate(-1),
        status: "paid",
        kind: "transfer",
        amount: 250,
        destination_amount: 250,
        source_account_id: cash.id,
        destination_account_id: savings.id,
      },
    ]),
    "Seed finance transactions",
  );
}

async function seedImportInbox(supabase, userId, wallets, categories) {
  const cash = wallets.find((wallet) => wallet.name === "E2E Everyday Cash");
  const groceries = categories.find((category) => category.name === "E2E Groceries");
  const transport = categories.find((category) => category.name === "E2E Transport");

  const batch = await requireNoError(
    await supabase
      .from("transaction_import_batches")
      .insert({
        user_id: userId,
        wallet_id: cash.id,
        source: "csv",
        file_name: "e2e-bank-export.csv",
        imported_rows: 3,
      })
      .select()
      .single(),
    "Seed import batch",
  );

  await requireNoError(
    await supabase.from("transaction_import_rules").insert({
      user_id: userId,
      merchant_pattern: "Market",
      category_id: groceries.id,
    }),
    "Seed import rule",
  );

  await requireNoError(
    await supabase.from("transaction_imports").insert([
      {
        user_id: userId,
        batch_id: batch.id,
        wallet_id: cash.id,
        external_id: "e2e-import-001",
        row_index: 1,
        fingerprint: "e2e-import-001",
        amount: 42.3,
        currency: "EUR",
        occurred_at: "2026-05-10",
        kind: "expense",
        merchant_raw: "E2E Market 24",
        merchant_clean: "E2E Market",
        category_id: groceries.id,
        status: "draft",
      },
      {
        user_id: userId,
        batch_id: batch.id,
        wallet_id: cash.id,
        external_id: "e2e-import-002",
        row_index: 2,
        fingerprint: "e2e-import-002",
        amount: 19.9,
        currency: "EUR",
        occurred_at: "2026-05-11",
        kind: "expense",
        merchant_raw: "E2E Transit",
        merchant_clean: "E2E Transit",
        category_id: transport.id,
        status: "draft",
      },
      {
        user_id: userId,
        batch_id: batch.id,
        wallet_id: cash.id,
        external_id: "e2e-import-003",
        row_index: 3,
        fingerprint: "e2e-import-003",
        amount: 120,
        currency: "EUR",
        occurred_at: "2026-05-12",
        kind: "income",
        merchant_raw: "E2E Reimbursement",
        merchant_clean: "E2E Reimbursement",
        status: "draft",
      },
    ]),
    "Seed import draft rows",
  );
}

function assertSafeE2eEmail(email) {
  const looksDedicated = /(^|[._+-])(e2e|test|codex|automation)([._+-]|@)/i.test(email);
  if (!looksDedicated && process.env.MONIQ_E2E_ALLOW_NON_TEST_EMAIL !== "true") {
    throw new Error(
      "MONIQ_E2E_EMAIL must look like a dedicated test account. " +
        "Use an email containing e2e/test/codex/automation, or set MONIQ_E2E_ALLOW_NON_TEST_EMAIL=true.",
    );
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = requiredEnv("MONIQ_E2E_EMAIL").trim().toLowerCase();
  const password = requiredEnv("MONIQ_E2E_PASSWORD");

  assertSafeE2eEmail(email);

  const sessionSupabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const adminSupabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

  const user = serviceRoleKey
    ? await ensureAuthUser(adminSupabase, email, password)
    : await ensureAuthSession(sessionSupabase, email, password);
  const dataClient = adminSupabase ?? sessionSupabase;
  await resetUserData(dataClient, user.id);

  const wallets = await seedWallets(dataClient, user.id);
  const savings = wallets.find((wallet) => wallet.name === "E2E Savings Vault");
  await seedAllocation(dataClient, user.id, savings.id);

  const categories = await seedCategories(dataClient, user.id);
  await seedTransactions(dataClient, user.id, wallets, categories);
  await seedImportInbox(dataClient, user.id, wallets, categories);

  console.log(`E2E user ready: ${email}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
