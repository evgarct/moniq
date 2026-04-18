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

export const Default: Story = {};

export const Large: Story = {
  args: {
    className: "text-2xl font-semibold",
  },
};

export const Negative: Story = {
  args: {
    amount: -2860.2,
    tone: "negative",
    display: "signed",
  },
};

export const Positive: Story = {
  args: {
    tone: "positive",
  },
};

export const Muted: Story = {
  args: {
    tone: "muted",
    className: "text-[12px]",
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

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">default (positive)</p>
        <MoneyAmount amount={4820.45} currency="EUR" tone="default" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">default (negative)</p>
        <MoneyAmount amount={-4820.45} currency="EUR" tone="default" display="signed" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">positive</p>
        <MoneyAmount amount={4820.45} currency="EUR" tone="positive" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">negative</p>
        <MoneyAmount amount={4820.45} currency="EUR" tone="negative" display="absolute" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">muted</p>
        <MoneyAmount amount={4820.45} currency="EUR" tone="muted" />
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {(
        [
          ["text-[10px]", "10px"],
          ["text-xs", "12px"],
          ["text-sm", "14px (default)"],
          ["text-base", "16px"],
          ["text-xl font-semibold", "xl semibold"],
          ["text-2xl font-semibold", "2xl semibold"],
          ["text-3xl font-bold", "3xl bold"],
        ] as const
      ).map(([cls, label]) => (
        <div key={cls} className="flex items-baseline gap-4">
          <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</span>
          <MoneyAmount amount={4820.45} currency="EUR" className={cls} />
        </div>
      ))}
    </div>
  ),
};
