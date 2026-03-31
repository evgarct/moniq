import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Molecules/TransactionList",
  component: TransactionList,
  args: {
    transactions: snapshot.transactions,
    emptyMessage: "No transactions yet.",
  },
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransactionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Monthly salary")).toBeInTheDocument();
  },
};

export const Compact: Story = {
  args: {
    compact: true,
  },
};

export const WithActions: Story = {
  args: {
    renderAction: () => (
      <Button variant="ghost" size="sm">
        Action
      </Button>
    ),
  },
};

export const Board: Story = {
  args: {
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

export const Empty: Story = {
  args: {
    transactions: [],
  },
};
