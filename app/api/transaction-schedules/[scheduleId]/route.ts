import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import {
  deleteTransactionSchedule,
  getFinanceSnapshot,
  setTransactionScheduleState,
  updateTransactionSchedule,
} from "@/features/finance/server/repository";
import { transactionScheduleInputSchema, transactionScheduleStateInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const payload = (await request.json()) as { mode?: "update" | "state"; values?: unknown; state?: unknown };
    const { scheduleId } = await params;

    if (payload.mode === "state") {
      const statePayload = transactionScheduleStateInputSchema.parse({ state: payload.state });
      await setTransactionScheduleState(scheduleId, statePayload.state);
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
