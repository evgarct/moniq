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
      created_at: new Date().toISOString(),
    }),
    name: "Investments",
  },
  category_id: "story-investment-category",
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

export const SaveToGoal: Story = {
  args: {
    transaction: byKind("save_to_goal"),
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
