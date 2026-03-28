import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MoneyAmount } from "@/components/money-amount";

const meta = {
  title: "Atoms/MoneyAmount",
  component: MoneyAmount,
  args: {
    amount: 4820.45,
    currency: "USD",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof MoneyAmount>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Positive: Story = {};

export const Negative: Story = {
  args: {
    amount: -2860.2,
    tone: "negative",
    display: "signed",
  },
};

export const Absolute: Story = {
  args: {
    amount: 10000,
    display: "absolute",
    className: "text-xl font-semibold",
  },
};
