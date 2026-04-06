import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Templates/BalanceWorkspace",
  component: AccountsView,
  args: {
    accounts: snapshot.accounts,
    allocations: snapshot.allocations,
    categories: snapshot.categories,
    transactions: snapshot.transactions,
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[#fbf8f4]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    accounts: snapshot.accounts,
    allocations: snapshot.allocations,
    categories: snapshot.categories,
    transactions: snapshot.transactions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Balance")).toBeInTheDocument();
    await expect(canvas.getByText("Transactions")).toBeInTheDocument();
  },
};
