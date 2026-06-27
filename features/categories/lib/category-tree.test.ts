import { describe, expect, it } from "vitest";

import type { Category } from "@/types/finance";
import { getInvestmentCategoryIds, getManageableCategories, isInvestmentCategory } from "./category-tree";

const categories = [
  { id: "wealth", parent_id: null, purpose: null, is_system: false },
  { id: "investments", parent_id: "wealth", purpose: "investment", is_system: false },
  { id: "etfs", parent_id: "investments", purpose: null, is_system: false },
  { id: "adjustment", parent_id: null, purpose: null, is_system: true },
] as Category[];

describe("category visibility and purpose", () => {
  it("keeps system categories out of management", () => {
    expect(getManageableCategories(categories).map((category) => category.id)).toEqual([
      "wealth",
      "investments",
      "etfs",
    ]);
  });

  it("treats the investment root and descendants as investment categories", () => {
    expect(Array.from(getInvestmentCategoryIds(categories))).toEqual(["investments", "etfs"]);
    expect(isInvestmentCategory(categories, "investments")).toBe(true);
    expect(isInvestmentCategory(categories, "etfs")).toBe(true);
    expect(isInvestmentCategory(categories, "wealth")).toBe(false);
  });
});
