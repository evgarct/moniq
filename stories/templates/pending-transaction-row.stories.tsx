import type { Meta, StoryObj } from "@storybook/react";
import { PendingTransactionRow } from "@/components/pending-transaction-row";

const ACCOUNTS = [
  { id: "acc-1", name: "Wallet" },
  { id: "acc-2", name: "Savings" },
  { id: "acc-3", name: "Credit Card" },
];

const CATEGORIES_EXPENSE = [
  { id: "cat-1", name: "Food & Dining", icon: null, parent_id: null },
  { id: "cat-2", name: "Transport", icon: null, parent_id: null },
];

const CATEGORIES_INCOME = [
  { id: "cat-3", name: "Salary", icon: null, parent_id: null },
  { id: "cat-4", name: "Freelance", icon: null, parent_id: null },
];

const KIND_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "save_to_goal", label: "Put on saving" },
  { value: "debt_payment", label: "Debt payment" },
  { value: "investment", label: "Investment" },
  { value: "refund", label: "Refund" },
  { value: "adjustment", label: "Balance adjustment" },
];

const meta: Meta<typeof PendingTransactionRow> = {
  title: "Templates/PendingTransactionRow",
  component: PendingTransactionRow,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof PendingTransactionRow>;

export const ExpenseWithAccount: Story = {
  name: "Expense — source account selected",
  args: {
    title: "PaySend",
    amount: 8279,
    currency: "CZK",
    kind: "expense",
    occurredAt: "2026-04-18",
    categories: CATEGORIES_EXPENSE,
    resolvedCategoryId: "cat-1",
    resolvedAccountId: "acc-1",
    accounts: ACCOUNTS,
    kindOptions: KIND_OPTIONS,
    onKindChange: () => {},
    onCategoryChange: () => {},
    onAccountChange: () => {},
    onDestinationAccountChange: () => {},
    status: "pending",
    sourceAccountPlaceholder: "From account",
    destinationAccountPlaceholder: "To account",
    selectCategoryPlaceholder: "Uncategorized",
    clearCategoryLabel: "Uncategorized",
  },
};

export const ExpenseNoAccount: Story = {
  name: "Expense — no account selected (shows placeholder)",
  args: {
    ...ExpenseWithAccount.args,
    resolvedCategoryId: null,
    resolvedAccountId: null,
  },
};

export const IncomeWithAccount: Story = {
  name: "Income — destination account selected",
  args: {
    title: "Apple Pay Top-up",
    amount: 9000,
    currency: "CZK",
    kind: "income",
    occurredAt: "2026-04-18",
    categories: CATEGORIES_INCOME,
    resolvedCategoryId: null,
    resolvedAccountId: null,
    resolvedDestinationAccountId: "acc-2",
    accounts: ACCOUNTS,
    kindOptions: KIND_OPTIONS,
    onKindChange: () => {},
    onCategoryChange: () => {},
    onAccountChange: () => {},
    onDestinationAccountChange: () => {},
    status: "pending",
    sourceAccountPlaceholder: "From account",
    destinationAccountPlaceholder: "To account",
    selectCategoryPlaceholder: "Uncategorized",
    clearCategoryLabel: "Uncategorized",
  },
};

export const TransferBothAccounts: Story = {
  name: "Transfer — both source and destination",
  args: {
    title: "Transfer to savings",
    amount: 5000,
    currency: "CZK",
    kind: "transfer",
    occurredAt: "2026-04-18",
    categories: [],
    resolvedCategoryId: null,
    resolvedAccountId: "acc-1",
    resolvedDestinationAccountId: "acc-2",
    accounts: ACCOUNTS,
    kindOptions: KIND_OPTIONS,
    onKindChange: () => {},
    onCategoryChange: () => {},
    onAccountChange: () => {},
    onDestinationAccountChange: () => {},
    status: "pending",
    sourceAccountPlaceholder: "From account",
    destinationAccountPlaceholder: "To account",
    selectCategoryPlaceholder: "Uncategorized",
    clearCategoryLabel: "Uncategorized",
  },
};

export const TransferNeitherSelected: Story = {
  name: "Transfer — no accounts selected (shows placeholders)",
  args: {
    ...TransferBothAccounts.args,
    resolvedAccountId: null,
    resolvedDestinationAccountId: null,
  },
};

export const ApprovedExpense: Story = {
  name: "Approved expense",
  args: {
    ...ExpenseWithAccount.args,
    status: "approved",
    statusLabel: "Approved",
  },
};

export const RejectedExpense: Story = {
  name: "Rejected expense",
  args: {
    ...ExpenseWithAccount.args,
    status: "rejected",
    statusLabel: "Rejected",
  },
};
