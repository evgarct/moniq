import { resolveCategoryBudget } from "@/features/budget/lib/budget-analytics";
import type { CategoryBudgetRow } from "@/types/finance";
import { roundMoney } from "@/features/budget/lib/envelope-budget";
import { convertMoney } from "@/features/finance/lib/exchange-rates";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate } from "@/types/finance";

/** Below this many days of history, or this many days with spending, a category uses the run-rate baseline. */
export const MIN_HISTORY_DAYS = 30;
export const MIN_ACTIVE_DAYS = 5;
export const TIGHT_BUDGET_RATIO = 0.9;
export const FORECAST_QUANTILES = [0.1, 0.5, 0.9] as const;

export type SpendingForecastStatus = "over_likely" | "over" | "tight" | "ok";
export type SpendingForecastMethod = "chronos" | "baseline";

/** JSON returned by the service-only SQL function `spending_forecast_source`. */
export type SpendingForecastSource = {
  default_currency: CurrencyCode | null;
  /** Monthly overrides and "from month" bases layered over each category's description plan. */
  category_budgets?: CategoryBudgetRow[];
  wallets: Array<{ id: string; currency: CurrencyCode }>;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    type: "income" | "expense";
    parent_id: string | null;
    purpose: string | null;
    is_contribution: boolean;
  }>;
  history: Array<{
    occurred_at: string;
    amount: number;
    category_id: string | null;
    source_account_id: string | null;
    schedule_id: string | null;
  }>;
  planned: Array<{
    occurred_at: string;
    amount: number;
    category_id: string | null;
    source_account_id: string | null;
  }>;
  exchange_rates: ExchangeRate[];
};

export type CategoryForecastInput = {
  categoryId: string;
  name: string;
  icon: string | null;
  budget: number;
  /** All paid spending of the category and its subcategories since the 1st, including recurring payments. */
  spentToDate: number;
  /** Known upcoming expenses (planned rows and not yet materialized schedule occurrences) until month end. */
  plannedRemaining: number;
  plannedByDate: Record<string, number>;
  /** Daily variable spending (recurring payments excluded) from the first recorded spend through today. */
  series: { start: string; values: number[] };
  historyDays: number;
  activeDays: number;
};

export type ForecastContext = {
  today: string;
  month: string;
  monthEnd: string;
  daysElapsed: number;
  daysInMonth: number;
  /** Days from tomorrow to the end of the month; 0 on the last day. */
  horizon: number;
};

export type ForecastInputs = {
  currency: CurrencyCode;
  context: ForecastContext;
  inputs: CategoryForecastInput[];
  /** Budgeted categories left out because an amount could not be converted to the default currency. */
  skipped: Array<{ categoryId: string; reason: "missing_rate" }>;
};

/** Daily quantile paths from the model, one value per day of the horizon. */
export type DailyQuantiles = { p10: number[]; p50: number[]; p90: number[] };

export type CategoryForecast = {
  categoryId: string;
  name: string;
  icon: string | null;
  budget: number;
  spentToDate: number;
  plannedRemaining: number;
  forecastP10: number;
  forecastP50: number;
  forecastP90: number;
  baselineRunrate: number;
  status: SpendingForecastStatus;
  expectedOverrunDate: string | null;
  method: SpendingForecastMethod;
};

function parseIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatIso(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDaysIso(date: string, days: number) {
  return formatIso(parseIso(date) + days * DAY_MS);
}

function diffDaysIso(later: string, earlier: string) {
  return Math.round((parseIso(later) - parseIso(earlier)) / DAY_MS);
}

export function buildForecastContext(today: string): ForecastContext {
  const [year, month, day] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = formatIso(Date.UTC(year, month - 1, 1));
  return {
    today,
    month: monthStart,
    monthEnd: formatIso(Date.UTC(year, month - 1, daysInMonth)),
    daysElapsed: day,
    daysInMonth,
    horizon: daysInMonth - day,
  };
}

/** Maps every category to its top-level ancestor; budgets and rollups live on the top level. */
function buildRootMap(categories: SpendingForecastSource["categories"]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const roots = new Map<string, string>();
  for (const category of categories) {
    let current = category;
    const seen = new Set<string>();
    while (current.parent_id && byId.has(current.parent_id) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parent_id)!;
    }
    roots.set(category.id, current.id);
  }
  return roots;
}

export function buildForecastInputs(source: SpendingForecastSource, today: string): ForecastInputs | null {
  const currency = source.default_currency;
  if (!currency) return null;

  const context = buildForecastContext(today);
  const walletCurrency = new Map(source.wallets.map((wallet) => [wallet.id, wallet.currency]));
  const roots = buildRootMap(source.categories);

  const budgeted = new Map<string, { name: string; icon: string | null; budget: number }>();
  for (const category of source.categories) {
    if (category.parent_id !== null || category.type !== "expense") continue;
    if (category.is_contribution || category.purpose === "investment") continue;
    const plannedBudget = resolveCategoryBudget(category, source.category_budgets, context.month).amount;
    if (plannedBudget === null || plannedBudget <= 0) continue;
    budgeted.set(category.id, { name: category.name, icon: category.icon, budget: plannedBudget });
  }

  const missing = new Set<string>();
  const toDefault = (row: { amount: number; occurred_at: string; source_account_id: string | null }, rootId: string) => {
    const sourceCurrency = row.source_account_id ? walletCurrency.get(row.source_account_id) : undefined;
    if (!sourceCurrency) {
      missing.add(rootId);
      return null;
    }
    const converted = convertMoney({
      amount: row.amount,
      sourceCurrency,
      targetCurrency: currency,
      requestedDate: row.occurred_at,
      exchangeRates: source.exchange_rates,
    });
    if (converted.status === "missing_rate") {
      missing.add(rootId);
      return null;
    }
    return converted.amount;
  };

  type Accumulator = {
    spent: number;
    firstDate: string | null;
    variableByDate: Map<string, number>;
    plannedByDate: Map<string, number>;
  };
  const accumulators = new Map<string, Accumulator>();
  const accumulatorFor = (rootId: string) => {
    let accumulator = accumulators.get(rootId);
    if (!accumulator) {
      accumulator = { spent: 0, firstDate: null, variableByDate: new Map(), plannedByDate: new Map() };
      accumulators.set(rootId, accumulator);
    }
    return accumulator;
  };

  for (const row of source.history) {
    const rootId = row.category_id ? roots.get(row.category_id) : undefined;
    if (!rootId || !budgeted.has(rootId)) continue;
    const amount = toDefault(row, rootId);
    if (amount === null) continue;
    const accumulator = accumulatorFor(rootId);
    if (accumulator.firstDate === null || row.occurred_at < accumulator.firstDate) {
      accumulator.firstDate = row.occurred_at;
    }
    if (row.occurred_at >= context.month) accumulator.spent += amount;
    // Recurring payments are known ahead of time, so the model only learns from variable spending.
    if (row.schedule_id === null) {
      accumulator.variableByDate.set(row.occurred_at, (accumulator.variableByDate.get(row.occurred_at) ?? 0) + amount);
    }
  }

  for (const row of source.planned) {
    const rootId = row.category_id ? roots.get(row.category_id) : undefined;
    if (!rootId || !budgeted.has(rootId)) continue;
    const amount = toDefault(row, rootId);
    if (amount === null) continue;
    const accumulator = accumulatorFor(rootId);
    accumulator.plannedByDate.set(row.occurred_at, (accumulator.plannedByDate.get(row.occurred_at) ?? 0) + amount);
  }

  const inputs: CategoryForecastInput[] = [];
  for (const [categoryId, meta] of budgeted) {
    if (missing.has(categoryId)) continue;
    const accumulator = accumulators.get(categoryId);
    const firstDate = accumulator?.firstDate ?? context.today;
    const historyDays = diffDaysIso(context.today, firstDate) + 1;
    const values: number[] = [];
    let activeDays = 0;
    for (let offset = 0; offset < historyDays; offset += 1) {
      const value = roundMoney(accumulator?.variableByDate.get(addDaysIso(firstDate, offset)) ?? 0);
      if (value > 0) activeDays += 1;
      values.push(value);
    }
    const plannedByDate: Record<string, number> = {};
    let plannedRemaining = 0;
    for (const [date, amount] of accumulator?.plannedByDate ?? []) {
      plannedByDate[date] = roundMoney(amount);
      plannedRemaining += amount;
    }

    inputs.push({
      categoryId,
      name: meta.name,
      icon: meta.icon,
      budget: roundMoney(meta.budget),
      spentToDate: roundMoney(accumulator?.spent ?? 0),
      plannedRemaining: roundMoney(plannedRemaining),
      plannedByDate,
      series: { start: firstDate, values },
      historyDays,
      activeDays,
    });
  }

  return {
    currency,
    context,
    inputs,
    skipped: Array.from(missing).map((categoryId) => ({ categoryId, reason: "missing_rate" as const })),
  };
}

/** True when the category has enough history for the model; otherwise it uses the run-rate baseline. */
export function isModelEligible(input: Pick<CategoryForecastInput, "historyDays" | "activeDays">) {
  return input.historyDays >= MIN_HISTORY_DAYS && input.activeDays >= MIN_ACTIVE_DAYS;
}

/**
 * Classifies a category. Money is rounded to cents before comparing so exactly-on-the-line amounts
 * (budget, 90% of budget) land on a deterministic side. The baseline carries no spread, so it never
 * claims "almost certainly over".
 */
export function classifyForecast(options: {
  budget: number;
  p10: number;
  p50: number;
  method: SpendingForecastMethod;
}): SpendingForecastStatus {
  const budget = roundMoney(options.budget);
  if (options.method === "chronos" && roundMoney(options.p10) > budget) return "over_likely";
  if (roundMoney(options.p50) > budget) return "over";
  if (roundMoney(options.p50) >= roundMoney(budget * TIGHT_BUDGET_RATIO)) return "tight";
  return "ok";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Builds the forecast of one category. `quantiles` are the model's daily paths for the remaining days; pass
 * null to use the run-rate baseline. Note: the sum of daily quantiles is not the quantile of the sum, so the
 * p10..p90 band is wider than the true interval. That is fine for the wording used in the digest.
 */
export function computeCategoryForecast(
  input: CategoryForecastInput,
  context: ForecastContext,
  quantiles: DailyQuantiles | null,
): CategoryForecast {
  const baselineRunrate = roundMoney((input.spentToDate / context.daysElapsed) * context.daysInMonth);
  const known = input.spentToDate + input.plannedRemaining;

  let method: SpendingForecastMethod;
  let variableP10: number;
  let variableP50: number;
  let variableP90: number;
  let dailyMedian: number[];

  if (quantiles) {
    for (const path of [quantiles.p10, quantiles.p50, quantiles.p90]) {
      if (path.length !== context.horizon) {
        throw new Error(`Forecast for ${input.categoryId} has ${path.length} days, expected ${context.horizon}`);
      }
    }
    method = "chronos";
    variableP10 = sum(quantiles.p10);
    variableP50 = sum(quantiles.p50);
    variableP90 = sum(quantiles.p90);
    dailyMedian = quantiles.p50;
  } else {
    // Pace so far, but never below what is already spent or scheduled.
    method = "baseline";
    variableP50 = Math.max(0, baselineRunrate - known);
    variableP10 = variableP50;
    variableP90 = variableP50;
    dailyMedian = Array.from({ length: context.horizon }, () => variableP50 / Math.max(context.horizon, 1));
  }

  const forecastP10 = roundMoney(known + variableP10);
  const forecastP50 = roundMoney(known + variableP50);
  const forecastP90 = roundMoney(known + variableP90);
  const status = classifyForecast({ budget: input.budget, p10: forecastP10, p50: forecastP50, method });

  let expectedOverrunDate: string | null = null;
  if ((status === "over" || status === "over_likely") && roundMoney(input.spentToDate) <= roundMoney(input.budget)) {
    let cumulative = input.spentToDate;
    for (let day = 0; day < context.horizon; day += 1) {
      const date = addDaysIso(context.today, day + 1);
      cumulative += (input.plannedByDate[date] ?? 0) + dailyMedian[day];
      if (roundMoney(cumulative) > roundMoney(input.budget)) {
        expectedOverrunDate = date;
        break;
      }
    }
  }

  return {
    categoryId: input.categoryId,
    name: input.name,
    icon: input.icon,
    budget: input.budget,
    spentToDate: input.spentToDate,
    plannedRemaining: input.plannedRemaining,
    forecastP10,
    forecastP50,
    forecastP90,
    baselineRunrate,
    status,
    expectedOverrunDate,
    method,
  };
}
