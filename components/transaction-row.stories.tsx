import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TransactionRow } from "@/components/transaction-row";
import { StoryDemoFrame, makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { Transaction } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const byKind = (kind: Transaction["kind"]) => snapshot.transactions.find((transaction) => transaction.kind === kind) ?? snapshot.transactions[0];
const investmentExpense: Transaction = {
  ...byKind("expense"),
  id: "story-investment-expense",
  title: "ETF portfolio top-up",
  category: {
    ...(byKind("expense").category ?? {
      id: "story-investment-category",
      user_id: "storybook-user",
      name: "Investments",
      icon: null,
      type: "expense",
      parent_id: null,
      is_system: false,
      created_at: new Date().toISOString(),
    }),
    name: "Investments",
  },
  category_id: "story-investment-category",
};
const plannedExpense: Transaction = {
  ...byKind("expense"),
  id: "story-planned-expense",
  title: "Netflix subscription",
  status: "planned",
  occurred_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + "T00:00:00.000Z",
};
const recurringPlanned: Transaction = {
  ...plannedExpense,
  id: "story-recurring-planned",
  title: "Monthly rent",
  schedule_id: "story-schedule-id",
  schedule: {
    id: "story-schedule-id",
    user_id: "storybook-user",
    title: "Monthly rent",
    note: null,
    start_date: "2026-01-01",
    frequency: "monthly",
    until_date: null,
    state: "active",
    kind: "expense",
    amount: 1200,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: null,
    source_account_id: byKind("expense").source_account_id,
    destination_account_id: null,
    category: byKind("expense").category,
    source_account: byKind("expense").source_account,
    destination_account: null,
    validation_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const meta = {
  title: "Molecules/TransactionRow",
  component: TransactionRow,
  args: {
    transaction: snapshot.transactions[0],
  },
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-3xl">
        <Story />
      </StoryDemoFrame>
    ),
  ],
} satisfies Meta<typeof TransactionRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Monthly salary")).toBeInTheDocument();
  },
};

export const Board: Story = {
  args: {
    transaction: snapshot.transactions[4],
    variant: "board",
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-[24px] bg-[#173540] p-4">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  args: {
    transaction: byKind("expense"),
    showDate: false,
    onClick: () => undefined,
  },
};

export const InteractiveBoard: Story = {
  args: {
    transaction: snapshot.transactions[4],
    variant: "board",
    onClick: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-[24px] bg-[#173540] p-4">
        <Story />
      </div>
    ),
  ],
};

export const WithContextMenu: Story = {
  name: "With Context Menu (right-click / long-press)",
  args: {
    transaction: byKind("expense"),
    showDate: false,
    onEditOccurrence: () => undefined,
    onDeleteTransaction: () => undefined,
    onMarkPaid: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "Right-click (desktop) or long-press (mobile) to open the context menu.",
      },
    },
  },
};

export const PlannedTransaction: Story = {
  name: "Planned (upcoming)",
  args: {
    transaction: plannedExpense,
    showDate: true,
    onEditOccurrence: () => undefined,
    onMarkPaid: () => undefined,
    onDeleteTransaction: () => undefined,
  },
};

export const RecurringPlanned: Story = {
  name: "Recurring + Planned",
  args: {
    transaction: recurringPlanned,
    showDate: true,
    onEditOccurrence: () => undefined,
    onEditSeries: () => undefined,
    onMarkPaid: () => undefined,
    onSkipOccurrence: () => undefined,
    onDeleteSeries: () => undefined,
    onToggleScheduleState: () => undefined,
  },
};

export const Income: Story = {
  args: {
    transaction: byKind("income"),
  },
};

export const Expense: Story = {
  args: {
    transaction: byKind("expense"),
  },
};

export const Transfer: Story = {
  args: {
    transaction: byKind("transfer"),
    showDate: false,
  },
};

export const InvestmentExpense: Story = {
  args: {
    transaction: investmentExpense,
    showDate: false,
  },
};

export const DebtPayment: Story = {
  args: {
    transaction: byKind("debt_payment"),
    showDate: false,
  },
};
