import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/finance";
import { buildRescheduleInput } from "./reschedule-transaction";

const recurringOccurrence = {
  id: "tx-1",
  title: "Rent",
  note: "flat",
  occurred_at: "2026-10-05",
  status: "planned",
  kind: "expense",
  amount: 500,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: "cat-1",
  source_account_id: "acc-1",
  destination_account_id: null,
  allocation_id: null,
  source_allocation_id: undefined,
  investment_instrument_id: undefined,
  investment_units: undefined,
  schedule_id: "sched-1",
  schedule_occurrence_date: "2026-10-01",
  is_schedule_override: true,
} as unknown as Transaction;

describe("buildRescheduleInput", () => {
  it("moves only the date and keeps the transaction planned", () => {
    const input = buildRescheduleInput(recurringOccurrence, "2026-10-08");

    expect(input.occurred_at).toBe("2026-10-08");
    expect(input.status).toBe("planned");
    expect(input.title).toBe("Rent");
    expect(input.amount).toBe(500);
    expect(input.source_account_id).toBe("acc-1");
  });

  it("never carries schedule slot fields, so the occurrence slot key stays untouched", () => {
    const input = buildRescheduleInput(recurringOccurrence, "2026-10-08") as Record<string, unknown>;

    expect(input).not.toHaveProperty("schedule_id");
    expect(input).not.toHaveProperty("schedule_occurrence_date");
    expect(input).not.toHaveProperty("is_schedule_override");
  });

  it("normalises missing optional relations to null", () => {
    const input = buildRescheduleInput(recurringOccurrence, "2026-10-08");

    expect(input.source_allocation_id).toBeNull();
    expect(input.investment_instrument_id).toBeNull();
    expect(input.investment_units).toBeNull();
  });
});
