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
try {
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
  const transactions = await admin.from("finance_transactions").delete().eq("schedule_id", id);
  if (transactions.error) throw transactions.error;
  const schedule = await admin.from("finance_transaction_schedules").delete().eq("id", id);
  if (schedule.error) throw schedule.error;
  const logout = await client.auth.signOut();
  if (logout.error) throw logout.error;
}
