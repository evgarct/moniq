import { describe, expect, it } from "vitest";

import {
  assertCategoryDeleteAllowed,
  assertCategoryUpdateAllowed,
} from "@/features/categories/lib/category-mutations";
import type { Category } from "@/types/finance";

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "category-1",
    user_id: "user-1",
    name: "Category",
    description: null,
    icon: null,
    type: "expense",
    parent_id: null,
    is_system: false,
    purpose: null,
    created_at: "2026-06-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("category mutation guards", () => {
  it("blocks updates and deletion for system categories", () => {
    const systemCategory = category({ is_system: true });

    expect(() => assertCategoryUpdateAllowed(systemCategory, "expense")).toThrow(
      "System categories cannot be edited.",
    );
    expect(() => assertCategoryDeleteAllowed(systemCategory)).toThrow(
      "System categories cannot be deleted.",
    );
  });

  it("keeps the marked investment category expense-only and undeletable", () => {
    const investmentCategory = category({ purpose: "investment" });

    expect(() => assertCategoryUpdateAllowed(investmentCategory, "income")).toThrow(
      "The investment category must remain an expense category.",
    );
    expect(() => assertCategoryDeleteAllowed(investmentCategory)).toThrow(
      "The investment category cannot be deleted.",
    );
    expect(() => assertCategoryUpdateAllowed(investmentCategory, "expense")).not.toThrow();
  });
});
