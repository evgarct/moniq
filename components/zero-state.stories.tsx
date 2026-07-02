import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ZeroState } from "@/components/zero-state";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Molecules/ZeroState",
  component: ZeroState,
  args: {
    illustration: "default",
    title: "No data available",
    description: "There is no information to display here at the moment.",
    action: <Button>Create first entry</Button>,
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] border border-dashed border-border rounded-lg bg-card/20">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ZeroState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WalletIllustration: Story = {
  args: {
    illustration: "wallet",
    title: "Add your first wallet",
    description: "Wallets help you keep track of cash, savings, cards, and debt.",
    action: <Button>Add Wallet</Button>,
  },
};

export const TransactionsIllustration: Story = {
  args: {
    illustration: "transactions",
    title: "No transactions yet",
    description: "Start tracking your spending by adding a new transaction.",
    action: <Button>New Transaction</Button>,
  },
};

export const BudgetIllustration: Story = {
  args: {
    illustration: "budget",
    title: "Plan your budget",
    description: "Assign limits to categories and watch your financial progress.",
    action: <Button>Setup Budget</Button>,
  },
};

export const CalendarIllustration: Story = {
  args: {
    illustration: "calendar",
    title: "No scheduled transfers",
    description: "Add recurring transaction templates to see them on your calendar.",
    action: <Button>Schedule payment</Button>,
  },
};

export const InboxIllustration: Story = {
  args: {
    illustration: "inbox",
    title: "Your inbox is empty",
    description: "Incoming transactions will appear here when imported.",
  },
};

export const ReportsIllustration: Story = {
  args: {
    illustration: "reports",
    title: "No series selected",
    description: "Please check at least one account to display projected balances.",
  },
};

export const SearchIllustration: Story = {
  args: {
    illustration: "search",
    title: "No keys found",
    description: "Generate a new API key to integrate with other apps.",
    action: <Button>Create key</Button>,
  },
};

export const TextOnly: Story = {
  args: {
    illustration: undefined,
    title: "Loading data...",
    description: "We are fetching your financial overview, hold tight.",
    action: undefined,
  },
};
