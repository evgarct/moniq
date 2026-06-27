import type { Category, CategoryType } from "@/types/finance";

export function assertCategoryUpdateAllowed(category: Category, nextType: CategoryType) {
  if (category.is_system) {
    throw new Error("System categories cannot be edited.");
  }

  if (category.purpose === "investment" && nextType !== "expense") {
    throw new Error("The investment category must remain an expense category.");
  }
}

export function assertCategoryDeleteAllowed(category: Category) {
  if (category.is_system) {
    throw new Error("System categories cannot be deleted.");
  }

  if (category.purpose === "investment") {
    throw new Error("The investment category cannot be deleted.");
  }
}
