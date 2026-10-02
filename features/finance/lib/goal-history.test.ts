import { describe, expect, it } from "vitest";
import { buildGoalHistory, summarizeGoalNet } from "./goal-history";

describe("source goal expense history", () => {
  it("counts paid source expenses as spending and planned expenses as zero", () => {
    const rows = [
      { id: "fund", kind: "income", status: "paid", amount: 1000, destination_allocation_id: "goal", occurred_at: "2026-09-01" },
      { id: "rent", kind: "expense", status: "paid", amount: 300, source_allocation_id: "goal", occurred_at: "2026-09-10" },
      { id: "next", kind: "expense", status: "planned", amount: 300, source_allocation_id: "goal", occurred_at: "2026-09-20" },
    ];
    expect(summarizeGoalNet("goal", rows)).toBe(700);
    expect(buildGoalHistory("goal", ["2026-09"], rows, "RUB").totals).toEqual({ added: 1000, withdrawn: 0, spent: 300, net: 700 });
  });
});
