import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { startOfToday, subMonths } from "date-fns";

import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();
const today = startOfToday();

const meta = {
  title: "Budget/BudgetBarChart",
  component: BudgetBarChart,
  parameters: { layout: "padded" },
} satisfies Meta<typeof BudgetBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// Current month is today — bars reflect real mock transactions
export const Default: Story = {
  args: {
    transactions: snapshot.transactions,
    currentMonth: today,
  },
};

// Navigate back 3 months — current month bar shifts left
export const PreviousMonth: Story = {
  args: {
    transactions: snapshot.transactions,
    currentMonth: subMonths(today, 3),
  },
};

// Empty state — all bars at zero
export const NoTransactions: Story = {
  args: {
    transactions: [],
    currentMonth: today,
  },
};
