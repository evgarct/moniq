import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Templates/AccountsView",
  component: AccountsView,
  args: {
    accounts: snapshot.accounts,
    allocations: snapshot.allocations,
    transactions: snapshot.transactions,
  },
  decorators: [
    (Story) => (
      <div className="h-screen overflow-hidden bg-[#fbf8f4] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Accounts & Wallets")).toBeInTheDocument();
    await expect(canvas.getByText("Free")).toBeInTheDocument();
  },
};
