import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TransactionFormSheet } from "@/features/transactions/components/transaction-form-sheet";
import { makeFinanceSnapshot, withPathname } from "@/stories/fixtures/story-data";
import type { TransactionSchedule } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const defaultTransaction = snapshot.transactions.find((transaction) => transaction.kind === "expense") ?? snapshot.transactions[0];
const savingsTransaction = snapshot.transactions.find((transaction) => transaction.kind === "save_to_goal") ?? snapshot.transactions[0];

const recurringSchedule: TransactionSchedule = {
  id: "schedule-story-netflix",
  user_id: "storybook-user",
  title: "Subscriptions (Netflix)",
  note: "Streaming subscription",
  start_date: "2026-03-01",
  frequency: "monthly",
  until_date: "2026-12-31",
  state: "active",
  kind: "expense",
  amount: 379,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: snapshot.categories.find((category) => category.type === "expense")?.id ?? null,
  source_account_id: snapshot.accounts[0]?.id ?? null,
  destination_account_id: null,
  allocation_id: null,
  category: snapshot.categories.find((category) => category.type === "expense") ?? null,
  source_account: snapshot.accounts[0] ?? null,
  destination_account: null,
  allocation: null,
  validation_error: null,
  created_at: "2026-03-01T08:00:00.000Z",
  updated_at: "2026-03-31T08:00:00.000Z",
};

const meta = {
  title: "Pages/Transaction Form Sheet",
  parameters: withPathname("/transactions"),
} satisfies Meta<typeof TransactionFormSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneOffExpense: Story = {
  render: () => (
    <div className="min-h-screen bg-[#173540] p-6">
      <TransactionFormSheet
        open
        mode="add"
        initialKind="expense"
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Save transaction" })).toBeInTheDocument();
    await expect(canvas.getByRole("switch")).toBeInTheDocument();
  },
};

export const RecurringExpense: Story = {
  render: () => (
    <div className="min-h-screen bg-[#173540] p-6">
      <TransactionFormSheet
        open
        mode="edit-schedule"
        schedule={recurringSchedule}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("End repeat")).toBeInTheDocument();
  },
};

export const SavingsMove: Story = {
  render: () => (
    <div className="min-h-screen bg-[#173540] p-6">
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={savingsTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Savings goal")).toBeInTheDocument();
  },
};

export const ExistingExpenseOccurrence: Story = {
  render: () => (
    <div className="min-h-screen bg-[#173540] p-6">
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={defaultTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </div>
  ),
};
