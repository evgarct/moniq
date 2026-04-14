import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { subMonths } from "date-fns";

import { Surface } from "@/components/surface";
import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Features/Budget/BudgetBarChart",
  component: BudgetBarChart,
  parameters: { layout: "padded" },
  argTypes: {
    // Hide the raw transaction array from the controls panel — not useful to edit there
    transactions: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <Story />
        </Surface>
      </div>
    ),
  ],
} satisfies Meta<typeof BudgetBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// All 13 months visible, current month (today) highlighted in dark
export const Default: Story = {
  args: {
    transactions: snapshot.transactions,
    currentMonth: new Date(),
  },
};

// Navigate 3 months back — highlighted bar shifts left, future months drop off right
export const PreviousMonth: Story = {
  args: {
    transactions: snapshot.transactions,
    currentMonth: subMonths(new Date(), 3),
  },
};

// Negative net month — mock data has a large vacation purchase in Oct 2025
// making net cashflow negative; bar renders below zero line in destructive color
export const NegativeMonth: Story = {
  args: {
    transactions: snapshot.transactions,
    currentMonth: subMonths(new Date(), 6),
  },
};

// No transactions at all — every bar is a thin stub at the zero line
export const Empty: Story = {
  args: {
    transactions: [],
    currentMonth: new Date(),
  },
};
