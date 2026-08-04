import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import {
  applyRecurringOccurrenceChanges,
  deleteTransactionSchedule,
  getFinanceSnapshot,
  setTransactionScheduleState,
  updateTransactionSchedule,
} from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { recurringOccurrenceSeriesUpdateSchema, transactionScheduleInputSchema, transactionScheduleStateInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  return withApiPerformance(request, "transaction_schedule_update", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = (await request.json()) as { mode?: "update" | "state" | "update-from-occurrence"; values?: unknown; state?: unknown; fromOccurrenceDate?: unknown; changes?: unknown };
      const { scheduleId } = await params;

      if (payload.mode === "update-from-occurrence") {
        const updatePayload = recurringOccurrenceSeriesUpdateSchema.parse(payload);
        await withMutationPerformance(request, "apply_recurring_occurrence_changes", () =>
          applyRecurringOccurrenceChanges(scheduleId, updatePayload.fromOccurrenceDate, updatePayload.changes),
        );
      } else if (payload.mode === "state") {
        const statePayload = transactionScheduleStateInputSchema.parse({ state: payload.state });
        await withMutationPerformance(request, "set_transaction_schedule_state", () => setTransactionScheduleState(scheduleId, statePayload.state));
      } else {
        const schedulePayload = transactionScheduleInputSchema.parse(payload.values);
        await withMutationPerformance(request, "update_transaction_schedule", () => updateTransactionSchedule(scheduleId, schedulePayload));
      }

      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.update");
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  return withApiPerformance(request, "transaction_schedule_delete", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const { scheduleId } = await params;
      await withMutationPerformance(request, "delete_transaction_schedule", () => deleteTransactionSchedule(scheduleId));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.delete");
    }
  });
}
