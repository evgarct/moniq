import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import { makeFinanceSnapshot, StoryWorkspace } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();
const regularTransaction = snapshot.transactions.find((transaction) => !transaction.schedule_id) ?? snapshot.transactions[0];
const recurringTransaction = {
  ...snapshot.transactions.find((transaction) => transaction.kind === "expense")!,
  schedule_id: "schedule-story",
  schedule: {
    id: "schedule-story",
    user_id: "storybook-user",
    title: "Recurring rent",
    note: null,
    start_date: "2026-03-01",
    frequency: "monthly" as const,
    until_date: null,
    state: "active" as const,
    kind: "expense" as const,
    amount: 1000,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: snapshot.categories[0]?.id ?? null,
    source_account_id: snapshot.accounts[0]?.id ?? null,
    destination_account_id: null,
    allocation_id: null,
    category: snapshot.categories[0] ?? null,
    source_account: snapshot.accounts[0] ?? null,
    destination_account: null,
    allocation: null,
    validation_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  status: "planned" as const,
};

const meta = {
  title: "Transactions/TransactionRowActions",
  component: TransactionRowActions,
  args: {
    transaction: recurringTransaction,
    onEditOccurrence: fn(),
    onEditSeries: fn(),
    onDeleteTransaction: fn(),
    onDeleteSeries: fn(),
    onMarkPaid: fn(),
    onSkipOccurrence: fn(),
    onToggleScheduleState: fn(),
  },
  decorators: [
    (Story) => (
      <StoryWorkspace pathname="/transactions">
        <div className="flex justify-end p-8">
          <Story />
        </div>
      </StoryWorkspace>
    ),
  ],
} satisfies Meta<typeof TransactionRowActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RecurringPlanned: Story = {};

export const OneOffCompact: Story = {
  args: {
    transaction: regularTransaction,
    compact: true,
  },
};

export const BoardCompact: Story = {
  args: {
    transaction: recurringTransaction,
    compact: true,
    variant: "board",
  },
};
