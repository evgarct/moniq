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
    transactions: { table: { disable: true } },
    categories: { table: { disable: true } },
    onMonthSelect: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <Story />
        </Surface>
      </div>
    ),
  ],
} satisfies Meta<typeof BudgetBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    transactions: snapshot.transactions,
    categories: snapshot.categories,
    targetCurrency: snapshot.preferences.default_currency,
    exchangeRates: snapshot.exchange_rates,
    currentMonth: new Date(),
    onMonthSelect: () => {},
  },
};

export const PreviousMonth: Story = {
  args: {
    transactions: snapshot.transactions,
    categories: snapshot.categories,
    targetCurrency: snapshot.preferences.default_currency,
    exchangeRates: snapshot.exchange_rates,
    currentMonth: subMonths(new Date(), 3),
    onMonthSelect: () => {},
  },
};

export const NegativeMonth: Story = {
  args: {
    transactions: snapshot.transactions,
    categories: snapshot.categories,
    targetCurrency: snapshot.preferences.default_currency,
    exchangeRates: snapshot.exchange_rates,
    currentMonth: subMonths(new Date(), 6),
    onMonthSelect: () => {},
  },
};

export const Empty: Story = {
  args: {
    transactions: [],
    categories: snapshot.categories,
    targetCurrency: snapshot.preferences.default_currency,
    exchangeRates: snapshot.exchange_rates,
    currentMonth: new Date(),
    onMonthSelect: () => {},
  },
};
