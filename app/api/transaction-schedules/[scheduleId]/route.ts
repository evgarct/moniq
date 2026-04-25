import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import {
  deleteTransactionSchedule,
  getFinanceSnapshot,
  rescheduleScheduleFromDate,
  setTransactionScheduleState,
  updateTransactionSchedule,
} from "@/features/finance/server/repository";
import { transactionScheduleInputSchema, transactionScheduleStateInputSchema } from "@/types/finance-schemas";

const reschedulePayloadSchema = z.object({
  fromOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const payload = (await request.json()) as { mode?: "update" | "state" | "reschedule"; values?: unknown; state?: unknown; fromOccurrenceDate?: unknown; newOccurrenceDate?: unknown };
    const { scheduleId } = await params;

    if (payload.mode === "state") {
      const statePayload = transactionScheduleStateInputSchema.parse({ state: payload.state });
      await setTransactionScheduleState(scheduleId, statePayload.state);
    } else if (payload.mode === "reschedule") {
      const reschedulePayload = reschedulePayloadSchema.parse({
        fromOccurrenceDate: payload.fromOccurrenceDate,
        newOccurrenceDate: payload.newOccurrenceDate,
      });
      await rescheduleScheduleFromDate(scheduleId, reschedulePayload.fromOccurrenceDate, reschedulePayload.newOccurrenceDate);
    } else {
      const schedulePayload = transactionScheduleInputSchema.parse(payload.values);
      await updateTransactionSchedule(scheduleId, schedulePayload);
    }

    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const { scheduleId } = await params;
    await deleteTransactionSchedule(scheduleId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.delete");
  }
}
