import { describe, expect, it } from "vitest";

import type { Account, WalletAllocation } from "@/types/finance";
import { getGoalAllocationsForSource } from "./goal-select";

const accounts = [
  { id: "cash", type: "cash" },
  { id: "savings", type: "saving" },
  { id: "other-savings", type: "saving" },
] as Account[];
const allocations = [
  { id: "goal", wallet_id: "savings" },
  { id: "other-goal", wallet_id: "other-savings" },
] as WalletAllocation[];

describe("goal selection", () => {
  it("only returns goals belonging to the selected savings wallet", () => {
    expect(getGoalAllocationsForSource(accounts, allocations, "cash")).toEqual([]);
    expect(getGoalAllocationsForSource(accounts, allocations, "savings")).toEqual([allocations[0]]);
  });
});
