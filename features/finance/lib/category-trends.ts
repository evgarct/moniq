import { endOfMonth, format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";

import { parseCategoryDescriptionAndBudget } from "@/features/budget/lib/budget-analytics";
import {
  buildCategorySpendingReport,
  type CategorySpendingCashFlow,
  type CategorySpendingNode,
} from "@/features/finance/lib/category-spending-report";
import type { Category, Transaction } from "@/types/finance";

export type CategoryTrendGroupBy = "envelope" | "category";

export const CATEGORY_TREND_GROUPINGS: CategoryTrendGroupBy[] = ["envelope", "category"];
export const DEFAULT_TREND_MONTHS = 6;
export const MAX_TREND_MONTHS = 12;

export type CategoryTrendSeries = {
  currency: string;
  /** One amount per entry of `months`, in the same order. */
  amounts: number[];
  total: number;
  /** Average per month over the months with meaningful income (see partial_months); all months if none qualify. */
  average: number;
  average_months: number;
  /** total as a percent of the income of the whole period in the same currency. */
  percent_of_period_income: number | null;
};

export type CategoryTrendRow = {
  category_id: string;
  name: string;
  path: string[];
  type: "income" | "expense";
  budget_amount: number | null;
  series: CategoryTrendSeries[];
};

export type CategoryTrendMonthSummary = Pick<
  CategorySpendingCashFlow,
  | "currency"
  | "income_total"
  | "pnl_net"
  | "debt_principal_paid"
  | "credit_card_payments"
  | "cash_flow_net"
  | "net_savings"
  | "invested"
  | "total_saved"
  | "income_is_partial"
  | "savings_rate"
> & { month: string; expense_total: number };

export type CategoryTrends = {
  start_month: string;
  end_month: string;
  months: string[];
  group_by: CategoryTrendGroupBy;
  rows: CategoryTrendRow[];
  monthly_summary: CategoryTrendMonthSummary[];
  /** Months whose income is below 10% of their expenses (incomplete data); excluded from averages and rates. */
  partial_months: { currency: string; months: string[] }[];
};

function isIsoMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const date = parseISO(`${value}-01`);
  return isValid(date) && format(date, "yyyy-MM") === value;
}

/** Resolves the inclusive month range; defaults to the last complete months ending last month. */
export function resolveTrendMonths(
  input: { start_month?: string; end_month?: string } = {},
  now: Date = new Date(),
): string[] {
  const lastComplete = startOfMonth(subMonths(now, 1));
  const end = input.end_month ?? format(lastComplete, "yyyy-MM");
  if (!isIsoMonth(end)) throw new Error("end_month must use YYYY-MM format.");

  const start = input.start_month ?? format(subMonths(parseISO(`${end}-01`), DEFAULT_TREND_MONTHS - 1), "yyyy-MM");
  if (!isIsoMonth(start)) throw new Error("start_month must use YYYY-MM format.");
  if (start > end) throw new Error("start_month must be before or equal to end_month.");

  const months: string[] = [];
  for (let cursor = parseISO(`${start}-01`); format(cursor, "yyyy-MM") <= end; cursor = startOfMonth(subMonths(cursor, -1))) {
    months.push(format(cursor, "yyyy-MM"));
    if (months.length > MAX_TREND_MONTHS) {
      throw new Error(`A trend can cover at most ${MAX_TREND_MONTHS} months.`);
    }
  }

  return months;
}

export function trendPeriodDates(months: string[]) {
  const first = parseISO(`${months[0]}-01`);
  const last = parseISO(`${months[months.length - 1]}-01`);
  return { start_date: format(startOfMonth(first), "yyyy-MM-dd"), end_date: format(endOfMonth(last), "yyyy-MM-dd") };
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function collectNodes(nodes: CategorySpendingNode[], type: "income" | "expense", groupBy: CategoryTrendGroupBy) {
  const collected: { node: CategorySpendingNode; type: "income" | "expense" }[] = [];

  const visit = (node: CategorySpendingNode) => {
    if (groupBy === "envelope" || node.categories.length === 0) {
      collected.push({ node, type });
      return;
    }
    for (const child of node.categories) visit(child);
  };

  for (const node of nodes) visit(node);
  return collected;
}

export function buildCategoryTrends(options: {
  categories: Category[];
  transactions: Transaction[];
  months: string[];
  groupBy?: CategoryTrendGroupBy;
}): CategoryTrends {
  const groupBy = options.groupBy ?? "envelope";
  const { months } = options;
  const rowsById = new Map<
    string,
    { node: CategorySpendingNode; type: "income" | "expense"; amountsByCurrency: Map<string, number[]> }
  >();
  const monthlySummary: CategoryTrendMonthSummary[] = [];
  const incomeByCurrency = new Map<string, number>();

  months.forEach((month, monthIndex) => {
    const report = buildCategorySpendingReport({ categories: options.categories, transactions: options.transactions, period: { month } });

    for (const total of report.currencies) {
      const flow = report.cash_flow.find((entry) => entry.currency === total.currency);
      monthlySummary.push({
        month,
        currency: total.currency,
        income_total: round2(total.income_total),
        expense_total: round2(total.expense_total),
        pnl_net: flow?.pnl_net ?? round2(total.net),
        debt_principal_paid: flow?.debt_principal_paid ?? 0,
        credit_card_payments: flow?.credit_card_payments ?? 0,
        cash_flow_net: flow?.cash_flow_net ?? round2(total.net),
        net_savings: flow?.net_savings ?? 0,
        invested: flow?.invested ?? 0,
        total_saved: flow?.total_saved ?? 0,
        income_is_partial: flow?.income_is_partial ?? total.income_total <= 0,
        savings_rate: flow?.savings_rate ?? null,
      });
      incomeByCurrency.set(total.currency, (incomeByCurrency.get(total.currency) ?? 0) + total.income_total);
    }

    const entries = [
      ...collectNodes(report.envelopes, "expense", groupBy),
      ...collectNodes(report.income_categories, "income", groupBy),
    ];

    for (const { node, type } of entries) {
      const row = rowsById.get(node.category_id) ?? { node, type, amountsByCurrency: new Map<string, number[]>() };
      for (const amount of node.totals) {
        const amounts = row.amountsByCurrency.get(amount.currency) ?? months.map(() => 0);
        amounts[monthIndex] = round2(amount.amount);
        row.amountsByCurrency.set(amount.currency, amounts);
      }
      rowsById.set(node.category_id, row);
    }
  });

  const partialIndexesByCurrency = new Map<string, Set<number>>();
  for (const entry of monthlySummary) {
    if (!entry.income_is_partial) continue;
    const indexes = partialIndexesByCurrency.get(entry.currency) ?? new Set<number>();
    indexes.add(months.indexOf(entry.month));
    partialIndexesByCurrency.set(entry.currency, indexes);
  }

  const rows: CategoryTrendRow[] = Array.from(rowsById.values())
    .map(({ node, type, amountsByCurrency }) => ({
      category_id: node.category_id,
      name: node.name,
      path: node.path,
      type,
      budget_amount: parseCategoryDescriptionAndBudget(node.description).plannedBudget,
      series: Array.from(amountsByCurrency.entries())
        .map(([currency, amounts]): CategoryTrendSeries => {
          const total = round2(amounts.reduce((sum, value) => sum + value, 0));
          const income = incomeByCurrency.get(currency) ?? 0;
          const partial = partialIndexesByCurrency.get(currency) ?? new Set<number>();
          let averaged = amounts.filter((_, index) => !partial.has(index));
          if (averaged.length === 0) averaged = amounts;
          return {
            currency,
            amounts,
            total,
            average: round2(averaged.reduce((sum, value) => sum + value, 0) / averaged.length),
            average_months: averaged.length,
            percent_of_period_income: income > 0 ? round2((total / income) * 100) : null,
          };
        })
        .sort((left, right) => left.currency.localeCompare(right.currency)),
    }))
    .sort((left, right) => {
      if (left.type !== right.type) return left.type === "income" ? -1 : 1;
      return (right.series[0]?.total ?? 0) - (left.series[0]?.total ?? 0);
    });

  return {
    start_month: months[0],
    end_month: months[months.length - 1],
    months,
    group_by: groupBy,
    rows,
    monthly_summary: monthlySummary,
    partial_months: Array.from(partialIndexesByCurrency.entries()).map(([currency, indexes]) => ({
      currency,
      months: Array.from(indexes).sort((a, b) => a - b).map((index) => months[index]),
    })),
  };
}
