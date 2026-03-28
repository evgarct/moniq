import { addDays, formatISO } from "date-fns";

import type { Account, Category, FinanceSnapshot, Transaction } from "@/types/finance";

export const mockCategories: Category[] = [
  { id: "housing", name: "Housing" },
  { id: "salary", name: "Salary" },
  { id: "groceries", name: "Groceries" },
  { id: "transport", name: "Transport" },
  { id: "health", name: "Health" },
  { id: "coffee", name: "Coffee" },
];

export const mockAccounts: Account[] = [
  { id: "everyday", name: "Everyday Checking", type: "checking", balance: 4820.45, currency: "USD" },
  { id: "reserve", name: "Rainy Day Savings", type: "savings", balance: 12400, currency: "USD" },
  { id: "wallet", name: "Cash Wallet", type: "cash", balance: 160, currency: "USD" },
];

const today = new Date();

export const mockTransactions: Transaction[] = [
  makeTransaction("salary-1", "Monthly salary", -4200, 0, "salary", "everyday", "paid", "income"),
  makeTransaction("rent-1", "Apartment rent", 1650, -2, "housing", "everyday", "paid", "expense"),
  makeTransaction("grocery-1", "Groceries refill", 86.4, -1, "groceries", "everyday", "paid", "expense"),
  makeTransaction("coffee-1", "Coffee with Alex", 7.5, 0, "coffee", "wallet", "paid", "expense"),
  makeTransaction("transport-1", "Train pass", 48, 0, "transport", "everyday", "planned", "expense"),
  makeTransaction("health-1", "Dentist follow-up", 95, 1, "health", "everyday", "planned", "expense"),
  makeTransaction("grocery-2", "Weekend groceries", 102.25, 2, "groceries", "everyday", "planned", "expense"),
  makeTransaction("cash-1", "ATM cash top-up", 60, -6, "transport", "wallet", "paid", "expense"),
];

export const mockFinanceSnapshot: FinanceSnapshot = {
  accounts: mockAccounts,
  categories: mockCategories,
  transactions: mockTransactions.sort((a, b) => a.date.localeCompare(b.date)).reverse(),
};

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
