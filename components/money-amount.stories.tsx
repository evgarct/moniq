import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MoneyAmount } from "@/components/money-amount";

const meta = {
  title: "Atoms/MoneyAmount",
  component: MoneyAmount,
  args: {
    amount: 4820.45,
    currency: "EUR",
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

export const CzechKoruna: Story = {
  args: {
    amount: 124850.45,
    currency: "CZK",
  },
};

export const RussianRuble: Story = {
  args: {
    amount: -184320,
    currency: "RUB",
    tone: "negative",
    display: "signed",
  },
};
