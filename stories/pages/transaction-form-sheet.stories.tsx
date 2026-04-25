import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RescheduleConfirmOverlay } from "@/features/transactions/components/reschedule-confirm-overlay";
import { TransactionFormSheet } from "@/features/transactions/components/transaction-form-sheet";
import { makeFinanceSnapshot, withPathname } from "@/stories/fixtures/story-data";
import type { Transaction, TransactionSchedule } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const defaultTransaction = snapshot.transactions.find((transaction) => transaction.kind === "expense") ?? snapshot.transactions[0];
const savingsTransaction = snapshot.transactions.find((transaction) => transaction.kind === "save_to_goal") ?? snapshot.transactions[0];
const incomeTransaction = snapshot.transactions.find((transaction) => transaction.kind === "income") ?? snapshot.transactions[0];
const transferTransaction = snapshot.transactions.find((transaction) => transaction.kind === "transfer") ?? snapshot.transactions[0];
const debtPaymentTransaction = snapshot.transactions.find((transaction) => transaction.kind === "debt_payment") ?? snapshot.transactions[0];
const investmentTransaction = snapshot.transactions.find((transaction) => transaction.kind === "investment") ?? snapshot.transactions[0];
const refundTransaction = snapshot.transactions.find((transaction) => transaction.kind === "refund") ?? snapshot.transactions[0];

// A planned occurrence linked to recurringSchedule (used by reschedule stories)
const recurringOccurrence: Transaction = {
  id: "tx-story-recurring-occurrence",
  user_id: "storybook-user",
  title: "Subscriptions (Netflix)",
  note: "Streaming subscription",
  occurred_at: "2026-05-01",
  created_at: "2026-04-25T08:00:00.000Z",
  status: "planned",
  kind: "expense",
  amount: 379,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: snapshot.categories.find((c) => c.type === "expense")?.id ?? null,
  source_account_id: snapshot.accounts[0]?.id ?? null,
  destination_account_id: null,
  allocation_id: null,
  schedule_id: "schedule-story-netflix",
  schedule_occurrence_date: "2026-05-01",
  is_schedule_override: false,
  category: snapshot.categories.find((c) => c.type === "expense") ?? null,
  source_account: snapshot.accounts[0] ?? null,
  destination_account: null,
  allocation: null,
  schedule: null,
};

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
        transactions={snapshot.transactions}
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
        transactions={snapshot.transactions}
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
        transactions={snapshot.transactions}
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
        transactions={snapshot.transactions}
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
        transactions={snapshot.transactions}
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
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const IncomeEdit: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={incomeTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const TransferEdit: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={transferTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const DebtPaymentEdit: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={debtPaymentTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const AddInvestment: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="add"
        initialKind="investment"
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const InvestmentEdit: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={investmentTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const AddRefund: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="add"
        initialKind="refund"
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const RefundEdit: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={refundTransaction}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

export const AddAdjustment: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="add"
        initialKind="adjustment"
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

// ─── Recurring occurrence edit + reschedule dialog ────────────────────────────

export const EditRecurringOccurrence: Story = {
  render: () => (
    <StorySurface>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={recurringOccurrence}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
    </StorySurface>
  ),
};

/** Shows the reschedule confirmation overlay that appears when the user changes
 *  the date on a planned recurring occurrence. Demonstrates the two choices:
 *  "Only this occurrence" vs "This and all following". */
export const RescheduleDialog: Story = {
  render: () => (
    <StorySurface>
      {/* Sheet form in background */}
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={recurringOccurrence}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
      {/* Overlay rendered on top — simulates the state after the user changed the date */}
      <div className="fixed inset-0 z-[60]">
        <RescheduleConfirmOverlay
          onOnlyThis={() => {}}
          onAllFollowing={() => {}}
          onCancel={() => {}}
        />
      </div>
    </StorySurface>
  ),
};

export const MobileRescheduleDialog: Story = {
  parameters: { viewport: { defaultViewport: "mobile2" } },
  render: () => (
    <StorySurface mobile>
      <TransactionFormSheet
        open
        mode="edit-transaction"
        transaction={recurringOccurrence}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        transactions={snapshot.transactions}
        onOpenChange={() => {}}
        onSubmit={async () => {}}
      />
      <div className="fixed inset-0 z-[60]">
        <RescheduleConfirmOverlay
          onOnlyThis={() => {}}
          onAllFollowing={() => {}}
          onCancel={() => {}}
        />
      </div>
    </StorySurface>
  ),
};
