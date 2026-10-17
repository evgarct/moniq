import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget, loadEnvFiles, requiredEnv } from "./staging-env.mjs";

loadEnvFiles();
const url = requiredEnv("STAGING_SUPABASE_URL");
assertStagingTarget(url, requiredEnv("SUPABASE_STAGING_PROJECT_REF"), requiredEnv("SUPABASE_PRODUCTION_PROJECT_REF"));
const admin = createClient(url, requiredEnv("STAGING_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers();
if (error) throw error;
const user = data.users.find(user => user.email?.endsWith("@example.invalid"));
assert(user, "Synthetic example.invalid user required");
const client = createClient(url, requiredEnv("STAGING_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const login = await client.auth.signInWithPassword({ email: user.email, password: requiredEnv("MONIQ_STAGING_PASSWORD") });
if (login.error) throw login.error;
const id = randomUUID();
const pensionId = randomUUID();
try {
  const pension = await admin.from("wallets").insert({ id: pensionId, user_id: user.id, name: "Concurrent synthetic pension", type: "pension", currency: "CZK", balance: 0 });
  if (pension.error) throw pension.error;
  const statement = { as_of: new Date().toISOString().slice(0,10), total_value: 1000, entries: [{ id: "employer", occurred_at: new Date().toISOString().slice(0,10), source: "employer", amount: 100 }] };
  const imports = await Promise.all(Array.from({ length: 3 }, () => client.rpc("upsert_pension_statement", { p_wallet_id: pensionId, p_statement: statement })));
  for (const result of imports) if (result.error) throw result.error;
  const saved = await admin.from("wallets").select("balance,pension_state").eq("id", pensionId).single();
  if (saved.error) throw saved.error;
  assert.equal(Number(saved.data.balance),1000);
  assert.equal(saved.data.pension_state.entries.length,1);
  const created = await admin.from("finance_transaction_schedules").insert({ id, user_id: user.id, title: "Concurrent synthetic schedule", start_date: new Date().toISOString().slice(0, 10), frequency: "monthly", kind: "expense", amount: 1 });
  if (created.error) throw created.error;
  const before = await admin.from("finance_transactions").select("id,schedule_occurrence_date").eq("schedule_id", id);
  assert(before.data?.length >= 18, "Create did not atomically materialize the horizon");
  const calls = await Promise.all(Array.from({ length: 3 }, () => client.rpc("reconcile_recurring_schedules")));
  for (const result of calls) if (result.error) throw result.error;
  const after = await admin.from("finance_transactions").select("id,schedule_occurrence_date").eq("schedule_id", id);
  assert.deepEqual(after.data?.map(row => row.id).sort(), before.data.map(row => row.id).sort());
  assert.equal(new Set(after.data.map(row => row.schedule_occurrence_date)).size, after.data.length);
  console.log("Concurrent reconciliation preserved every slot and ID.");
} finally {
  const pension = await admin.from("wallets").delete().eq("id", pensionId);
  if (pension.error) throw pension.error;
  const transactions = await admin.from("finance_transactions").delete().eq("schedule_id", id);
  if (transactions.error) throw transactions.error;
  const schedule = await admin.from("finance_transaction_schedules").delete().eq("id", id);
  if (schedule.error) throw schedule.error;
  const logout = await client.auth.signOut();
  if (logout.error) throw logout.error;
}
