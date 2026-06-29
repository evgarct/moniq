import { createClient } from "@supabase/supabase-js";

import { assertStagingTarget, loadEnvFiles, requiredEnv } from "./staging-env.mjs";

loadEnvFiles();

const stagingRef = requiredEnv("SUPABASE_STAGING_PROJECT_REF");
const productionRef = requiredEnv("SUPABASE_PRODUCTION_PROJECT_REF");
const url = requiredEnv("STAGING_SUPABASE_URL");
const key = requiredEnv("STAGING_SUPABASE_SERVICE_ROLE_KEY");
assertStagingTarget(url, stagingRef, productionRef);

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const requiredTables = [
  "wallets",
  "wallet_allocations",
  "finance_categories",
  "finance_transactions",
  "finance_transaction_schedules",
  "user_preferences",
  "investment_positions",
  "investment_instruments",
  "investment_quotes",
  "finance_sync_mutations",
];

for (const table of requiredTables) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) throw new Error(`${table}: ${error.message}`);
}

for (const table of [
  "wallets",
  "wallet_allocations",
  "finance_categories",
  "finance_transactions",
  "finance_transaction_schedules",
  "user_preferences",
]) {
  const { error } = await supabase.from(table).select("sync_version").limit(1);
  if (error) throw new Error(`${table}.sync_version: ${error.message}`);
}

console.log(`Verified ${requiredTables.length} staging tables and sync-version columns.`);
