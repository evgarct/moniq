import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import {
  deleteTransactionSchedule,
  getFinanceSnapshot,
  rescheduleScheduleFromDate,
  setTransactionScheduleState,
  updateTransactionSchedule,
  updateTransactionScheduleNote,
} from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { transactionScheduleInputSchema, transactionScheduleStateInputSchema } from "@/types/finance-schemas";

const reschedulePayloadSchema = z.object({
  fromOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  return withApiPerformance(request, "transaction_schedule_update", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = (await request.json()) as { mode?: "update" | "state" | "reschedule" | "update-note"; values?: unknown; state?: unknown; fromOccurrenceDate?: unknown; newOccurrenceDate?: unknown; note?: unknown };
      const { scheduleId } = await params;

      if (payload.mode === "state") {
        const statePayload = transactionScheduleStateInputSchema.parse({ state: payload.state });
        await withMutationPerformance(request, "set_transaction_schedule_state", () => setTransactionScheduleState(scheduleId, statePayload.state));
      } else if (payload.mode === "reschedule") {
        const reschedulePayload = reschedulePayloadSchema.parse({
          fromOccurrenceDate: payload.fromOccurrenceDate,
          newOccurrenceDate: payload.newOccurrenceDate,
        });
        await withMutationPerformance(request, "reschedule_transaction_schedule", () =>
          rescheduleScheduleFromDate(scheduleId, reschedulePayload.fromOccurrenceDate, reschedulePayload.newOccurrenceDate),
        );
      } else if (payload.mode === "update-note") {
        const note = typeof payload.note === "string" ? payload.note : null;
        await withMutationPerformance(request, "update_transaction_schedule_note", () =>
          updateTransactionScheduleNote(scheduleId, note),
        );
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
