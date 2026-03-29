import type { CurrencyCode } from "@/types/currency";
import { getTransactionAnalyticsAmount } from "@/features/transactions/lib/transaction-utils";
import type { Category, CategoryTreeNode, Transaction } from "@/types/finance";

export function buildCategoryTree(categories: Category[], transactions: Transaction[]): CategoryTreeNode[] {
  const totals = transactions.reduce<Map<string, number>>((accumulator, transaction) => {
    if (!transaction.category_id) {
      return accumulator;
    }

    accumulator.set(
      transaction.category_id,
      (accumulator.get(transaction.category_id) ?? 0) + getTransactionAnalyticsAmount(transaction),
    );

    return accumulator;
  }, new Map());

  const totalsByCurrency = transactions.reduce<Map<string, Map<string, number>>>((accumulator, transaction) => {
    if (!transaction.category_id) {
      return accumulator;
    }

    const currency = transaction.source_account?.currency ?? transaction.destination_account?.currency;

    if (!currency) {
      return accumulator;
    }

    const totalsForCategory = accumulator.get(transaction.category_id) ?? new Map<string, number>();
    totalsForCategory.set(currency, (totalsForCategory.get(currency) ?? 0) + getTransactionAnalyticsAmount(transaction));
    accumulator.set(transaction.category_id, totalsForCategory);

    return accumulator;
  }, new Map());

  const byParent = new Map<string | null, Category[]>();

  for (const category of categories) {
    const items = byParent.get(category.parent_id) ?? [];
    items.push(category);
    byParent.set(category.parent_id, items);
  }

  function buildNodes(parentId: string | null, depth: number): CategoryTreeNode[] {
    return (byParent.get(parentId) ?? [])
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((category) => {
        const children = buildNodes(category.id, depth + 1);
        const total_amount =
          (totals.get(category.id) ?? 0) + children.reduce((sum, child) => sum + child.total_amount, 0);
        const currencyTotals = new Map(totalsByCurrency.get(category.id) ?? []);

        for (const child of children) {
          for (const total of child.totals_by_currency) {
            currencyTotals.set(total.currency, (currencyTotals.get(total.currency) ?? 0) + total.amount);
          }
        }

        return {
          ...category,
          children,
          depth,
          total_amount,
          totals_by_currency: Array.from(currencyTotals.entries(), ([currency, amount]) => ({
            currency: currency as CurrencyCode,
            amount,
          })),
        };
      });
  }

  return buildNodes(null, 0);
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

export function getCategoryDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [categoryId];

  while (queue.length) {
    const current = queue.shift()!;
    for (const category of categories) {
      if (category.parent_id !== current || descendants.has(category.id)) {
        continue;
      }

      descendants.add(category.id);
      queue.push(category.id);
    }
  }

  return descendants;
}

export function validateCategoryHierarchy(categories: Category[], values: { categoryId?: string; parent_id?: string | null; type: Category["type"] }) {
  if (!values.parent_id) {
    return;
  }

  const parent = categories.find((category) => category.id === values.parent_id);

  if (!parent) {
    throw new Error("Parent category not found.");
  }

  if (parent.type !== values.type) {
    throw new Error("Parent category must have the same type.");
  }

  if (values.categoryId) {
    if (values.parent_id === values.categoryId) {
      throw new Error("A category cannot be its own parent.");
    }

    const descendants = getCategoryDescendantIds(categories, values.categoryId);

    if (descendants.has(values.parent_id)) {
      throw new Error("A category cannot be moved under its own descendant.");
    }
  }
}
