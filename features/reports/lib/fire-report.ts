import { format, isBefore, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { convertMoney } from "@/features/finance/lib/exchange-rates";
import { getPurchasedUnits } from "@/features/investments/lib/positions";
import type { CurrencyCode } from "@/types/currency";
import type { Account, ExchangeRate, InvestmentPosition, Transaction } from "@/types/finance";

export const FIRE_REPORT_PRESET_MONTHS = [6, 12, 24, 36, 60] as const;

export type FireReportSeriesId = "income" | "expenses" | "investment-income";

export type FireReportPoint = {
  date: string; // "yyyy-MM-dd"
  balance: number;
};

export type FireReportSeries = {
  id: FireReportSeriesId;
  name: string;
  points: FireReportPoint[];
};

export type FireReport = {
  currency: CurrencyCode;
  series: FireReportSeries[];
  start_date: string;
  end_date: string;
};

type MonthPeriod = {
  monthKey: string;
  start: Date;
  end: Date;
  dateString: string;
};

function getPeriodMonths(now: Date, count: number): MonthPeriod[] {
  const list: MonthPeriod[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const start = startOfMonth(d);
    const end = isBefore(now, endOfMonth(d)) ? now : endOfMonth(d);
    list.push({
      monthKey: format(d, "yyyy-MM"),
      start,
      end,
      dateString: format(end, "yyyy-MM-dd"),
    });
  }
  return list;
}

function getInstrumentPrice(
  instrumentId: string,
  latestQuotePrice: number | null,
  transactions: Transaction[],
): number {
  if (latestQuotePrice !== null) return latestQuotePrice;

  // Fallback: Find the latest purchase transaction price for this instrument
  const purchaseTxs = transactions
    .filter(
      (t) =>
        t.investment_instrument_id === instrumentId &&
        t.status === "paid" &&
        t.kind === "expense" &&
        t.amount > 0 &&
        (t.investment_units ?? 0) > 0,
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  if (purchaseTxs.length > 0) {
    const tx = purchaseTxs[0];
    return tx.amount / (tx.investment_units ?? 1);
  }

  return 0;
}

function rollbackTransaction(
  balances: Map<string, number>,
  units: Map<string, number>,
  transaction: Transaction,
) {
  // Rollback account balances
  if (transaction.source_account_id && balances.has(transaction.source_account_id)) {
    balances.set(
      transaction.source_account_id,
      (balances.get(transaction.source_account_id) ?? 0) + transaction.amount,
    );
  }

  if (transaction.destination_account_id && balances.has(transaction.destination_account_id)) {
    balances.set(
      transaction.destination_account_id,
      (balances.get(transaction.destination_account_id) ?? 0) -
        (transaction.destination_amount ?? transaction.amount),
    );
  }

  // Rollback investment units
  if (
    transaction.kind === "expense" &&
    transaction.investment_instrument_id &&
    units.has(transaction.investment_instrument_id)
  ) {
    units.set(
      transaction.investment_instrument_id,
      Math.max(
        0,
        (units.get(transaction.investment_instrument_id) ?? 0) -
          (transaction.investment_units ?? 0),
      ),
    );
  }
}

export function buildFireReport(options: {
  accounts: Account[];
  transactions: Transaction[];
  exchangeRates: ExchangeRate[];
  defaultCurrency: CurrencyCode;
  investmentPositions: InvestmentPosition[];
  accountIds: string[];
  periodMonths: number;
  now?: Date;
  labels: {
    income: string;
    expenses: string;
    investmentIncome: string;
  };
}): FireReport {
  const referenceDate = options.now ?? new Date();
  const months = getPeriodMonths(referenceDate, options.periodMonths);

  const accountsById = new Map(options.accounts.map((a) => [a.id, a]));
  const selectedAccountIds = new Set(options.accountIds);

  // Initialize running state with current balances and investment units
  const runningBalances = new Map<string, number>(
    options.accounts
      .filter((a) => selectedAccountIds.has(a.id))
      .map((a) => [a.id, a.balance]),
  );

  const runningUnits = new Map<string, number>();
  for (const pos of options.investmentPositions) {
    runningUnits.set(
      pos.instrument_id,
      pos.opening_units + getPurchasedUnits(options.transactions, pos.instrument_id),
    );
  }

  // Find any other instruments present in transactions but not in positions to track units
  for (const tx of options.transactions) {
    if (
      tx.status === "paid" &&
      tx.kind === "expense" &&
      tx.investment_instrument_id &&
      !runningUnits.has(tx.investment_instrument_id)
    ) {
      runningUnits.set(
        tx.investment_instrument_id,
        getPurchasedUnits(options.transactions, tx.investment_instrument_id),
      );
    }
  }

  // Sort paid transactions descending to rollback walk
  const paidTransactions = options.transactions
    .filter((t) => t.status === "paid")
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  let txIndex = 0;

  // We will build points backwards then reverse them to chronological order
  const incomePoints: FireReportPoint[] = [];
  const expensesPoints: FireReportPoint[] = [];
  const investmentIncomePoints: FireReportPoint[] = [];

  // Iterate backwards from the latest month to the earliest
  for (let i = months.length - 1; i >= 0; i--) {
    const month = months[i];
    const monthEndStr = month.dateString;
    const monthStartStr = format(month.start, "yyyy-MM-dd");

    // 1. Rollback transactions that occurred after the end of this month
    while (txIndex < paidTransactions.length) {
      const tx = paidTransactions[txIndex];
      if (tx.occurred_at > monthEndStr) {
        rollbackTransaction(runningBalances, runningUnits, tx);
        txIndex++;
      } else {
        break;
      }
    }

    // 2. Sum up Income and Expenses in this specific month
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    const monthTxs = options.transactions.filter(
      (t) =>
        t.status === "paid" &&
        t.occurred_at >= monthStartStr &&
        t.occurred_at <= monthEndStr,
    );

    for (const tx of monthTxs) {
      const txAccountId = tx.source_account_id ?? tx.destination_account_id;
      const txCurrency =
        (txAccountId ? accountsById.get(txAccountId)?.currency : null) ??
        tx.source_account?.currency ??
        options.defaultCurrency;

      if (tx.kind === "income") {
        const conversion = convertMoney({
          amount: tx.amount,
          sourceCurrency: txCurrency,
          targetCurrency: options.defaultCurrency,
          requestedDate: tx.occurred_at,
          exchangeRates: options.exchangeRates,
        });
        monthlyIncome += conversion.amount;
      } else if (tx.kind === "expense") {
        const conversion = convertMoney({
          amount: tx.amount,
          sourceCurrency: txCurrency,
          targetCurrency: options.defaultCurrency,
          requestedDate: tx.occurred_at,
          exchangeRates: options.exchangeRates,
        });
        monthlyExpenses += conversion.amount;
      }
    }

    // 3. Calculate Portfolio Value at the end of this month
    let portfolioValue = 0;

    // A: Selected Account Balances
    for (const [accountId, balance] of runningBalances) {
      const account = accountsById.get(accountId);
      if (!account) continue;

      const conversion = convertMoney({
        amount: balance,
        sourceCurrency: account.currency,
        targetCurrency: options.defaultCurrency,
        requestedDate: monthEndStr,
        exchangeRates: options.exchangeRates,
      });
      portfolioValue += conversion.amount;
    }

    // B: Investment Positions Value
    for (const pos of options.investmentPositions) {
      const unitsHeld = runningUnits.get(pos.instrument_id) ?? 0;
      if (unitsHeld <= 0) continue;

      const price = getInstrumentPrice(pos.instrument_id, pos.latest_quote?.price ?? null, options.transactions);
      const nativeValue = unitsHeld * price;

      const conversion = convertMoney({
        amount: nativeValue,
        sourceCurrency: pos.instrument.quote_currency,
        targetCurrency: options.defaultCurrency,
        requestedDate: monthEndStr,
        exchangeRates: options.exchangeRates,
      });
      portfolioValue += conversion.amount;
    }

    // Passive SWR Income (4% per year, divided by 12 months, bounded to 0 as it cannot be negative)
    const swrIncome = Math.max(0, (portfolioValue * 0.04) / 12);

    incomePoints.push({ date: monthEndStr, balance: monthlyIncome });
    expensesPoints.push({ date: monthEndStr, balance: monthlyExpenses });
    investmentIncomePoints.push({ date: monthEndStr, balance: swrIncome });
  }

  // Reverse back to chronological order (earliest first)
  incomePoints.reverse();
  expensesPoints.reverse();
  investmentIncomePoints.reverse();

  return {
    currency: options.defaultCurrency,
    series: [
      { id: "income", name: options.labels.income, points: incomePoints },
      { id: "expenses", name: options.labels.expenses, points: expensesPoints },
      { id: "investment-income", name: options.labels.investmentIncome, points: investmentIncomePoints },
    ],
    start_date: months[0].dateString,
    end_date: months[months.length - 1].dateString,
  };
}
