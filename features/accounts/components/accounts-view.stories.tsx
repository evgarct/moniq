import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { WalletAllocation } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const denseSavingsSnapshot = makeFinanceSnapshot();
const denseReserve = denseSavingsSnapshot.accounts.find((account) => account.id === "reserve");
const denseSavingsAllocations: WalletAllocation[] = denseReserve
  ? [
      {
        id: "reserve-rent",
        user_id: denseReserve.user_id,
        wallet_id: denseReserve.id,
        name: "Rent buffer",
        kind: "goal_open",
        amount: 2600,
        target_amount: null,
        created_at: denseReserve.created_at,
        updated_at: denseReserve.created_at,
      },
      {
        id: "reserve-emergency",
        user_id: denseReserve.user_id,
        wallet_id: denseReserve.id,
        name: "Emergency fund",
        kind: "goal_targeted",
        amount: 4200,
        target_amount: 8000,
        created_at: denseReserve.created_at,
        updated_at: denseReserve.created_at,
      },
      {
        id: "reserve-taxes",
        user_id: denseReserve.user_id,
        wallet_id: denseReserve.id,
        name: "Quarterly taxes",
        kind: "goal_open",
        amount: 1500,
        target_amount: null,
        created_at: denseReserve.created_at,
        updated_at: denseReserve.created_at,
      },
      {
        id: "reserve-travel",
        user_id: denseReserve.user_id,
        wallet_id: denseReserve.id,
        name: "Long trip",
        kind: "goal_targeted",
        amount: 900,
        target_amount: 2400,
        created_at: denseReserve.created_at,
        updated_at: denseReserve.created_at,
      },
    ]
  : [];

const meta = {
  title: "Templates/BalanceWorkspace",
  component: AccountsView,
  args: {
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    transactions: snapshot.transactions,
    allocations: snapshot.allocations,
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-[#fbf8f4]">
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
    categories: snapshot.categories,
    transactions: snapshot.transactions,
    allocations: snapshot.allocations,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Balance")).toBeInTheDocument();
    await expect(canvas.getByText("Transactions")).toBeInTheDocument();
  },
};

export const DenseSavingsBuckets: Story = {
  args: {
    accounts: denseSavingsSnapshot.accounts,
    categories: denseSavingsSnapshot.categories,
    transactions: denseSavingsSnapshot.transactions,
    allocations: denseSavingsAllocations,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Euro Reserve")).toBeInTheDocument();
    await expect(canvas.getByText("Emergency fund")).toBeInTheDocument();
    await expect(canvas.getByText("Quarterly taxes")).toBeInTheDocument();
  },
};
