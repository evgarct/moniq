import type { Meta, StoryObj } from "@storybook/nextjs-vite";

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

function StorySurface({
  children,
  mobile = false,
}: {
  children: React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f4efe9] p-6">
      <div className={mobile ? "mx-auto min-h-[780px] max-w-[390px] overflow-hidden rounded-[28px] bg-background shadow-[0_24px_80px_rgba(15,23,42,0.14)]" : ""}>
        {children}
      </div>
    </div>
  );
}

const meta = {
  title: "Organisms/TransactionFormSheet",
  parameters: {
    ...withPathname("/transactions"),
    layout: "fullscreen",
  },
} satisfies Meta<typeof TransactionFormSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BatchExpense: Story = {
  render: () => (
    <StorySurface>
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
    </StorySurface>
  ),
};

export const BatchSavings: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="add"
        initialKind="save_to_goal"
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const EditOccurrence: Story = {
  render: () => (
    <StorySurface>
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
    </StorySurface>
  ),
};

export const EditSeries: Story = {
  render: () => (
    <StorySurface>
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
    </StorySurface>
  ),
};

export const MobileBatchExpense: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  render: () => (
    <StorySurface mobile>
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
    </StorySurface>
  ),
};

export const SavingsMove: Story = {
  render: () => (
    <StorySurface>
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
    </StorySurface>
  ),
};
