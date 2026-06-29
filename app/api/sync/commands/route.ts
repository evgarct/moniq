import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  categoryInputSchema,
  transactionEntryBatchInputSchema,
  transactionEntryInputSchema,
  transactionInputSchema,
  transactionScheduleInputSchema,
  userPreferencesInputSchema,
  walletAllocationInputSchema,
  walletInputSchema,
} from "@/types/finance-schemas";
import {
  adjustWalletBalance,
  createCategory,
  createTransactionEntry,
  createTransactionEntryBatch,
  createWallet,
  createWalletAllocation,
  deleteCategory,
  deleteTransaction,
  deleteTransactionSchedule,
  deleteWallet,
  deleteWalletAllocation,
  getFinanceSnapshot,
  markTransactionPaid,
  rescheduleScheduleFromDate,
  setTransactionScheduleState,
  skipTransactionOccurrence,
  updateCategory,
  updateTransaction,
  updateTransactionSchedule,
  updateUserPreferences,
  updateWallet,
  updateWalletAllocation,
} from "@/features/finance/server/repository";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { SyncCommand, SyncCommandResult } from "@/types/sync";

const commandTypeSchema = z.enum([
  "wallet.create", "wallet.update", "wallet.adjust", "wallet.delete",
  "category.create", "category.update", "category.delete",
  "transaction.create", "transaction.update", "transaction.delete", "transaction.markPaid", "transaction.skip",
  "schedule.update", "schedule.state", "schedule.reschedule", "schedule.delete",
  "allocation.create", "allocation.update", "allocation.delete",
  "preferences.update",
]);

const commandSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  type: commandTypeSchema,
  targetId: z.string().uuid().nullable(),
  baseVersion: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});
const requestSchema = z.object({ commands: z.array(commandSchema).min(1).max(25) });
const offlineTransactionBatchSchema = z.object({
  entries: z.array(z.object({ id: z.string().uuid(), values: transactionEntryInputSchema })).min(1),
});

const entityByType: Record<string, { table: string; idColumn: string }> = {
  wallet: { table: "wallets", idColumn: "id" },
  category: { table: "finance_categories", idColumn: "id" },
  transaction: { table: "finance_transactions", idColumn: "id" },
  schedule: { table: "finance_transaction_schedules", idColumn: "id" },
  allocation: { table: "wallet_allocations", idColumn: "id" },
  preferences: { table: "user_preferences", idColumn: "user_id" },
};

function errorCode(error: unknown) {
  if (error instanceof z.ZodError) return "INVALID_COMMAND_PAYLOAD";
  return "COMMAND_REJECTED";
}

async function executeCommand(command: SyncCommand) {
  const payload = command.payload as Record<string, unknown>;
  switch (command.type) {
    case "wallet.create": return createWallet(walletInputSchema.parse(payload), command.targetId!, command.id);
    case "wallet.update": return updateWallet(command.targetId!, walletInputSchema.parse(payload));
    case "wallet.adjust": return adjustWalletBalance(command.targetId!, Number(payload.newBalance), typeof payload.note === "string" ? payload.note : null);
    case "wallet.delete": return deleteWallet(command.targetId!);
    case "category.create": return createCategory(categoryInputSchema.parse(payload), command.targetId!);
    case "category.update": return updateCategory(command.targetId!, categoryInputSchema.parse(payload));
    case "category.delete": return deleteCategory(command.targetId!, typeof payload.replacementCategoryId === "string" ? payload.replacementCategoryId : null);
    case "transaction.create": {
      const offlineBatch = offlineTransactionBatchSchema.safeParse(payload);
      if (offlineBatch.success) {
        for (const entry of offlineBatch.data.entries) await createTransactionEntry(entry.values, entry.id);
        return;
      }
      const batch = transactionEntryBatchInputSchema.safeParse(payload);
      return batch.success
        ? createTransactionEntryBatch(batch.data.entries)
        : createTransactionEntry(transactionEntryInputSchema.parse(payload), command.targetId ?? undefined);
    }
    case "transaction.update": return updateTransaction(command.targetId!, transactionInputSchema.parse(payload));
    case "transaction.delete": return deleteTransaction(command.targetId!);
    case "transaction.markPaid": return markTransactionPaid(command.targetId!);
    case "transaction.skip": return skipTransactionOccurrence(command.targetId!);
    case "schedule.update": return updateTransactionSchedule(command.targetId!, transactionScheduleInputSchema.parse(payload));
    case "schedule.state": return setTransactionScheduleState(command.targetId!, z.enum(["active", "paused"]).parse(payload.state));
    case "schedule.reschedule": return rescheduleScheduleFromDate(command.targetId!, z.string().parse(payload.fromOccurrenceDate), z.string().parse(payload.newOccurrenceDate));
    case "schedule.delete": return deleteTransactionSchedule(command.targetId!);
    case "allocation.create": return createWalletAllocation(z.string().uuid().parse(payload.walletId), walletAllocationInputSchema.parse(payload.values), command.targetId!);
    case "allocation.update": return updateWalletAllocation(command.targetId!, walletAllocationInputSchema.parse(payload));
    case "allocation.delete": return deleteWalletAllocation(command.targetId!);
    case "preferences.update": return updateUserPreferences(userPreferencesInputSchema.parse(payload));
  }
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SYNC_STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_COMMAND_BATCH" }, { status: 400 });

  const service = createServiceClient();
  const results: SyncCommandResult[] = [];
  for (const raw of parsed.data.commands) {
    const command = raw as SyncCommand;
    const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const { data: existing } = await service.from("finance_sync_mutations").select("payload_hash, status, result, error_code").eq("id", command.id).eq("user_id", user.id).maybeSingle();
    if (existing) {
      if (existing.payload_hash !== hash) {
        results.push({ id: command.id, status: "rejected", errorCode: "IDEMPOTENCY_KEY_REUSED" });
      } else if (existing.status === "applied") {
        results.push({ id: command.id, status: "applied", serverVersion: (existing.result as { serverVersion?: number | null } | null)?.serverVersion ?? null });
      } else if (existing.status === "conflict") {
        results.push({ id: command.id, status: "conflict", serverVersion: (existing.result as { serverVersion?: number } | null)?.serverVersion ?? 1, serverRecord: null });
      } else {
        results.push({ id: command.id, status: "rejected", errorCode: existing.error_code ?? "COMMAND_PENDING" });
      }
      continue;
    }

    const { error: claimError } = await service.from("finance_sync_mutations").insert({
      id: command.id,
      user_id: user.id,
      device_id: command.deviceId,
      command_type: command.type,
      target_id: command.targetId,
      base_version: command.baseVersion,
      payload_hash: hash,
    });
    if (claimError) {
      const { data: claimed } = await service.from("finance_sync_mutations")
        .select("payload_hash, status, result, error_code")
        .eq("id", command.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!claimed || claimed.payload_hash !== hash) {
        results.push({ id: command.id, status: "rejected", errorCode: "IDEMPOTENCY_KEY_REUSED" });
      } else if (claimed.status === "applied") {
        results.push({ id: command.id, status: "applied", serverVersion: (claimed.result as { serverVersion?: number | null } | null)?.serverVersion ?? null });
      } else {
        results.push({ id: command.id, status: "rejected", errorCode: claimed.error_code ?? "COMMAND_PENDING" });
      }
      continue;
    }

    const family = command.type.split(".")[0];
    const entity = entityByType[family];
    let serverRecord: Record<string, unknown> | null = null;
    if (entity && command.type !== `${family}.create`) {
      const targetId = family === "preferences" ? user.id : command.targetId;
      const { data } = await service.from(entity.table).select("*").eq(entity.idColumn, targetId).eq("user_id", user.id).maybeSingle();
      serverRecord = data as Record<string, unknown> | null;
      const serverVersion = Number(serverRecord?.sync_version ?? 1);
      if (!serverRecord || command.baseVersion === null || serverVersion !== command.baseVersion) {
        const result = { serverVersion };
        await service.from("finance_sync_mutations").update({ status: "conflict", result, completed_at: new Date().toISOString() }).eq("id", command.id);
        results.push({ id: command.id, status: "conflict", serverVersion, serverRecord });
        continue;
      }
    }

    try {
      await executeCommand(command);
      const snapshot = await getFinanceSnapshot();
      const nextRecord = family === "wallet" ? snapshot.accounts.find((item) => item.id === command.targetId)
        : family === "category" ? snapshot.categories.find((item) => item.id === command.targetId)
          : family === "transaction" ? snapshot.transactions.find((item) => item.id === command.targetId)
            : family === "schedule" ? snapshot.schedules.find((item) => item.id === command.targetId)
              : family === "allocation" ? snapshot.allocations.find((item) => item.id === command.targetId)
                : family === "preferences" ? snapshot.preferences : undefined;
      const serverVersion = nextRecord?.sync_version ?? null;
      await service.from("finance_sync_mutations").update({ status: "applied", result: { serverVersion }, completed_at: new Date().toISOString() }).eq("id", command.id);
      results.push({ id: command.id, status: "applied", serverVersion });
    } catch (error) {
      const code = errorCode(error);
      await service.from("finance_sync_mutations").update({ status: "rejected", error_code: code, completed_at: new Date().toISOString() }).eq("id", command.id);
      results.push({ id: command.id, status: "rejected", errorCode: code });
    }
  }

  const hasConflict = results.some((result) => result.status === "conflict");
  return NextResponse.json({ results }, { status: hasConflict ? 409 : 200 });
}
