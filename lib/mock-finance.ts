import { addDays, formatISO, subMonths } from "date-fns";

import type { Account, Allocation, Category, FinanceSnapshot, Transaction } from "@/types/finance";

const userId = "user-demo";
const today = new Date();

export const mockCategories: Category[] = [
  { id: "income-root", user_id: userId, name: "Income", icon: "banknote-arrow-up", type: "income", parent_id: null, created_at: formatISO(subMonths(today, 12)) },
  { id: "salary", user_id: userId, name: "Salary", icon: "briefcase-business", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 11)) },
  { id: "business-income", user_id: userId, name: "Business income", icon: "building-2", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 10)) },
  { id: "money-back", user_id: userId, name: "Money Back", icon: "rotate-ccw", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 9)) },
  { id: "gifts-income", user_id: userId, name: "Gifts", icon: "gift", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 9)) },
  { id: "interest-income", user_id: userId, name: "Interest income", icon: "landmark", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 8)) },
  { id: "income-other", user_id: userId, name: "Other", icon: "ellipsis", type: "income", parent_id: "income-root", created_at: formatISO(subMonths(today, 8)) },
  { id: "core-bills", user_id: userId, name: "Core Bills", icon: "receipt", type: "expense", parent_id: null, created_at: formatISO(subMonths(today, 12)) },
  { id: "rent", user_id: userId, name: "Rent", icon: "house", type: "expense", parent_id: "core-bills", created_at: formatISO(subMonths(today, 11)) },
  { id: "loans", user_id: userId, name: "Loans", icon: "circle-dollar-sign", type: "expense", parent_id: "core-bills", created_at: formatISO(subMonths(today, 11)) },
  { id: "living-costs", user_id: userId, name: "Living Costs", icon: "wallet", type: "expense", parent_id: null, created_at: formatISO(subMonths(today, 10)) },
  { id: "food-home", user_id: userId, name: "Food & Home", icon: "shopping-cart", type: "expense", parent_id: "living-costs", created_at: formatISO(subMonths(today, 10)) },
  { id: "transport", user_id: userId, name: "Transport", icon: "bus-front", type: "expense", parent_id: "living-costs", created_at: formatISO(subMonths(today, 9)) },
  { id: "enjoy-life", user_id: userId, name: "Enjoy Life", icon: "party-popper", type: "expense", parent_id: null, created_at: formatISO(subMonths(today, 9)) },
  { id: "eat-out-chill", user_id: userId, name: "Eat Out & Chill", icon: "utensils-crossed", type: "expense", parent_id: "enjoy-life", created_at: formatISO(subMonths(today, 8)) },
  { id: "subscriptions", user_id: userId, name: "Subscriptions", icon: "repeat", type: "expense", parent_id: "enjoy-life", created_at: formatISO(subMonths(today, 8)) },
  { id: "music", user_id: userId, name: "Music", icon: "music-4", type: "expense", parent_id: "enjoy-life", created_at: formatISO(subMonths(today, 8)) },
  { id: "travel-prep", user_id: userId, name: "Travel Prep", icon: "luggage", type: "expense", parent_id: "enjoy-life", created_at: formatISO(subMonths(today, 8)) },
  { id: "travel-stay", user_id: userId, name: "Travel Stay", icon: "bed", type: "expense", parent_id: "enjoy-life", created_at: formatISO(subMonths(today, 8)) },
  { id: "next-safe", user_id: userId, name: "Next & Safe", icon: "shield", type: "expense", parent_id: null, created_at: formatISO(subMonths(today, 7)) },
  { id: "cushion", user_id: userId, name: "Cushion", icon: "shield", type: "expense", parent_id: "next-safe", created_at: formatISO(subMonths(today, 7)) },
  { id: "wealth", user_id: userId, name: "Wealth", icon: "trending-up", type: "expense", parent_id: null, created_at: formatISO(subMonths(today, 7)) },
  { id: "investments", user_id: userId, name: "Investments", icon: "trending-up", type: "expense", parent_id: "wealth", created_at: formatISO(subMonths(today, 7)) },
];

export const mockAccounts: Account[] = [
  {
    id: "everyday",
    user_id: userId,
    name: "Prague Everyday Card",
    type: "cash",
    cash_kind: "debit_card",
    balance: 124850.45,
    currency: "CZK",
    created_at: formatISO(subMonths(today, 18)),
  },
  {
    id: "reserve",
    user_id: userId,
    name: "Euro Reserve",
    type: "saving",
    balance: 10000,
    currency: "EUR",
    created_at: formatISO(subMonths(today, 24)),
  },
  {
    id: "travel",
    user_id: userId,
    name: "Travel Savings",
    type: "saving",
    balance: 6400,
    currency: "EUR",
    created_at: formatISO(subMonths(today, 10)),
  },
  {
    id: "ruble-card",
    user_id: userId,
    name: "Ruble Debit Card",
    type: "cash",
    cash_kind: "debit_card",
    balance: 64800,
    currency: "RUB",
    created_at: formatISO(subMonths(today, 12)),
  },
  {
    id: "travel-credit",
    user_id: userId,
    name: "Travel Credit Card",
    type: "credit_card",
    balance: -13253.33,
    credit_limit: 50000,
    currency: "CZK",
    created_at: formatISO(subMonths(today, 14)),
  },
  {
    id: "auto-loan",
    user_id: userId,
    name: "Car Loan",
    type: "debt",
    debt_kind: "loan",
    balance: -286000,
    currency: "CZK",
    created_at: formatISO(subMonths(today, 42)),
  },
];

export const mockAllocations: Allocation[] = [
  makeAllocation("rent-buffer", "reserve", "Rent buffer", 4000, "goal_open"),
  makeAllocation("travel-goal", "reserve", "Travel", 3000, "goal_targeted", 5000),
  makeAllocation("emergency-fund", "reserve", "Emergency fund", 3000, "goal_targeted", 10000),
  makeAllocation("summer-trip", "travel", "Summer trip", 2500, "goal_targeted", 4000),
];

export const mockTransactions: Transaction[] = [
  makeTransaction({
    id: "salary-1",
    title: "Monthly salary",
    kind: "income",
    amount: 96500,
    dayOffset: 0,
    categoryId: "salary",
    destinationAccountId: "everyday",
    status: "paid",
  }),
  makeTransaction({
    id: "rent-1",
    title: "Apartment rent",
    kind: "expense",
    amount: 28500,
    dayOffset: -2,
    categoryId: "rent",
    sourceAccountId: "everyday",
    status: "paid",
  }),
  makeTransaction({
    id: "grocery-1",
    title: "Groceries refill",
    kind: "expense",
    amount: 2160.4,
    dayOffset: -1,
    categoryId: "food-home",
    sourceAccountId: "everyday",
    status: "paid",
  }),
  makeTransaction({
    id: "coffee-1",
    title: "Coffee with Alex",
    kind: "expense",
    amount: 125,
    dayOffset: 0,
    categoryId: "eat-out-chill",
    sourceAccountId: "everyday",
    status: "paid",
  }),
  makeTransaction({
    id: "transfer-czk-rub",
    title: "Move cash for Moscow trip",
    kind: "transfer",
    amount: 5200,
    destinationAmount: 19100,
    fxRate: 3.6731,
    dayOffset: -3,
    sourceAccountId: "everyday",
    destinationAccountId: "ruble-card",
    status: "planned",
  }),
  makeTransaction({
    id: "save-goal",
    title: "Top up summer trip",
    kind: "save_to_goal",
    amount: 180,
    destinationAmount: 180,
    dayOffset: -4,
    sourceAccountId: "everyday",
    destinationAccountId: "travel",
    allocationId: "summer-trip",
    status: "paid",
  }),
  makeTransaction({
    id: "debt-payment",
    title: "Car loan payment",
    kind: "debt_payment",
    amount: 8200,
    principalAmount: 5000,
    interestAmount: 1700,
    extraPrincipalAmount: 1500,
    dayOffset: -5,
    categoryId: "loans",
    sourceAccountId: "everyday",
    destinationAccountId: "auto-loan",
    status: "paid",
  }),
  makeTransaction({
    id: "credit-card-hotel",
    title: "Hotel booking",
    kind: "expense",
    amount: 4680,
    dayOffset: -6,
    categoryId: "travel-stay",
    sourceAccountId: "travel-credit",
    status: "paid",
  }),
  makeTransaction({
    id: "credit-card-flight",
    title: "Flight tickets",
    kind: "expense",
    amount: 8573.33,
    dayOffset: -11,
    categoryId: "travel-prep",
    sourceAccountId: "travel-credit",
    status: "paid",
  }),
];

export const mockFinanceSnapshot: FinanceSnapshot = {
  accounts: mockAccounts,
  allocations: mockAllocations,
  categories: mockCategories,
  schedules: [],
  transactions: mockTransactions.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).reverse(),
};

function makeAllocation(
  id: string,
  accountId: string,
  name: string,
  amount: number,
  kind: Allocation["kind"],
  targetAmount: number | null = null,
): Allocation {
  return {
    id,
    user_id: userId,
    account_id: accountId,
    name,
    kind,
    amount,
    target_amount: kind === "goal_targeted" ? targetAmount : null,
    created_at: formatISO(subMonths(today, 3)),
  };
}

function makeTransaction(values: {
  id: string;
  title: string;
  kind: Transaction["kind"];
  amount: number;
  dayOffset: number;
  categoryId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  allocationId?: string;
  destinationAmount?: number;
  fxRate?: number;
  principalAmount?: number;
  interestAmount?: number;
  extraPrincipalAmount?: number;
  status: Transaction["status"];
}): Transaction {
  const category = values.categoryId ? mockCategories.find((item) => item.id === values.categoryId) ?? null : null;
  const sourceAccount = values.sourceAccountId ? mockAccounts.find((item) => item.id === values.sourceAccountId) ?? null : null;
  const destinationAccount = values.destinationAccountId ? mockAccounts.find((item) => item.id === values.destinationAccountId) ?? null : null;
  const allocation = values.allocationId ? mockAllocations.find((item) => item.id === values.allocationId) ?? null : null;

  return {
    id: values.id,
    user_id: userId,
    title: values.title,
    note: null,
    occurred_at: formatISO(addDays(today, values.dayOffset), { representation: "date" }),
    created_at: formatISO(addDays(today, values.dayOffset)),
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destinationAmount ?? null,
    fx_rate: values.fxRate ?? null,
    principal_amount: values.principalAmount ?? null,
    interest_amount: values.interestAmount ?? null,
    extra_principal_amount: values.extraPrincipalAmount ?? null,
    category_id: category?.id ?? null,
    source_account_id: sourceAccount?.id ?? null,
    destination_account_id: destinationAccount?.id ?? null,
    allocation_id: allocation?.id ?? null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category,
    source_account: sourceAccount,
    destination_account: destinationAccount,
    allocation,
    schedule: null,
  };
}
