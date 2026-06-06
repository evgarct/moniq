import { addDays, format, subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { selectTodayAgenda } from "@/features/today/lib/today-agenda";
import type { Transaction } from "@/types/finance";

const today = new Date(2026, 5, 6);

function transaction(id: string, day: Date, status: Transaction["status"]) {
  return {
    id,
    occurred_at: format(day, "yyyy-MM-dd"),
    status,
  } as Transaction;
}

describe("selectTodayAgenda", () => {
  it("includes overdue, today's activity, and planned operations through today plus three", () => {
    const result = selectTodayAgenda(
      [
        transaction("overdue", subDays(today, 2), "planned"),
        transaction("today-planned", today, "planned"),
        transaction("today-paid", today, "paid"),
        transaction("day-three", addDays(today, 3), "planned"),
        transaction("day-four", addDays(today, 4), "planned"),
        transaction("old-paid", subDays(today, 1), "paid"),
        transaction("skipped", today, "skipped"),
      ],
      today,
      null,
    );

    expect(result.planned.map((item) => item.id)).toEqual(["overdue", "today-planned", "day-three"]);
    expect(result.paid.map((item) => item.id)).toEqual(["today-paid"]);
  });

  it("shows planned and paid only for a selected date", () => {
    const selected = addDays(today, 2);
    const result = selectTodayAgenda(
      [
        transaction("selected-planned", selected, "planned"),
        transaction("selected-paid", selected, "paid"),
        transaction("today", today, "paid"),
      ],
      today,
      selected,
    );

    expect(result.planned.map((item) => item.id)).toEqual(["selected-planned"]);
    expect(result.paid.map((item) => item.id)).toEqual(["selected-paid"]);
  });
});
