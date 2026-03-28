import { addDays, formatISO, subMonths } from "date-fns";

import type { Account, Allocation, Category, FinanceSnapshot, Transaction } from "@/types/finance";

const userId = "user-demo";
const today = new Date();

export const mockCategories: Category[] = [
  { id: "housing", name: "Housing" },
  { id: "salary", name: "Salary" },
  { id: "groceries", name: "Groceries" },
  { id: "transport", name: "Transport" },
  { id: "health", name: "Health" },
  { id: "coffee", name: "Coffee" },
  { id: "debt", name: "Debt service" },
];

export const mockAccounts: Account[] = [
  {
    id: "everyday",
    user_id: userId,
    name: "Everyday Checking",
    type: "checking",
    balance: 4820.45,
    currency: "USD",
    created_at: formatISO(subMonths(today, 18)),
  },
  {
    id: "reserve",
    user_id: userId,
    name: "Rainy Day Savings",
    type: "savings",
    balance: 10000,
    currency: "USD",
    created_at: formatISO(subMonths(today, 24)),
  },
  {
    id: "travel",
    user_id: userId,
    name: "Travel Savings",
    type: "savings",
    balance: 6400,
    currency: "USD",
    created_at: formatISO(subMonths(today, 10)),
  },
  {
    id: "amex",
    user_id: userId,
    name: "Amex Gold",
    type: "credit_card",
    balance: -2860.2,
    currency: "USD",
    created_at: formatISO(subMonths(today, 30)),
  },
  {
    id: "auto-loan",
    user_id: userId,
    name: "Auto Loan",
    type: "loan",
    balance: -12450,
    currency: "USD",
    created_at: formatISO(subMonths(today, 42)),
  },
  {
    id: "mortgage",
    user_id: userId,
    name: "Home Mortgage",
    type: "mortgage",
    balance: -214500,
    currency: "USD",
    created_at: formatISO(subMonths(today, 60)),
  },
];

export const mockAllocations: Allocation[] = [
  makeAllocation("rent-buffer", "reserve", "Rent buffer", 4000),
  makeAllocation("travel-goal", "reserve", "Travel", 3000),
  makeAllocation("emergency-fund", "reserve", "Emergency fund", 3000),
  makeAllocation("summer-trip", "travel", "Summer trip", 2500),
  makeAllocation("pet-travel", "travel", "Pet expenses", 600),
  makeAllocation("gear-upgrade", "travel", "Yearly purchases", 900),
];

export const mockTransactions: Transaction[] = [
  makeTransaction("salary-1", "Monthly salary", -4200, 0, "salary", "everyday", "paid", "income"),
  makeTransaction("rent-1", "Apartment rent", 1650, -2, "housing", "everyday", "paid", "expense"),
  makeTransaction("grocery-1", "Groceries refill", 86.4, -1, "groceries", "everyday", "paid", "expense"),
  makeTransaction("coffee-1", "Coffee with Alex", 7.5, 0, "coffee", "everyday", "paid", "expense"),
  makeTransaction("transport-1", "Train pass", 48, 0, "transport", "everyday", "planned", "expense"),
  makeTransaction("health-1", "Dentist follow-up", 95, 1, "health", "everyday", "planned", "expense"),
  makeTransaction("savings-topup", "Move to rainy day savings", 900, -4, "housing", "reserve", "paid", "expense"),
  makeTransaction("credit-card-payment", "Amex payment", 450, -5, "debt", "amex", "paid", "expense"),
  makeTransaction("mortgage-payment", "Mortgage autopay", 1780, -8, "debt", "mortgage", "paid", "expense"),
];

export const mockFinanceSnapshot: FinanceSnapshot = {
  accounts: mockAccounts,
  allocations: mockAllocations,
  categories: mockCategories,
  transactions: mockTransactions.sort((a, b) => a.date.localeCompare(b.date)).reverse(),
};

function makeAllocation(id: string, accountId: string, name: string, amount: number): Allocation {
  return {
    id,
    user_id: userId,
    account_id: accountId,
    name,
    amount,
    created_at: formatISO(subMonths(today, 3)),
  };
}

function makeTransaction(
  id: string,
  title: string,
  amount: number,
  dayOffset: number,
  categoryId: string,
  accountId: string,
  status: Transaction["status"],
  type: Transaction["type"],
): Transaction {
  const account = mockAccounts.find((item) => item.id === accountId) ?? mockAccounts[0];
  const category = mockCategories.find((item) => item.id === categoryId) ?? mockCategories[0];

  return {
    id,
    title,
    amount,
    date: formatISO(addDays(today, dayOffset), { representation: "date" }),
    category,
    account,
    status,
    type,
  };
}
