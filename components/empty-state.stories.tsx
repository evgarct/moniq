import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const meta = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  args: {
    title: "No wallets yet",
    description: "Create your first wallet to start organizing cash, savings, cards, and debt.",
    action: <Button>Add wallet</Button>,
    illustration: "default",
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Wallet: Story = {
  args: {
    illustration: "wallet",
    title: "No wallets yet",
    description: "Create your first wallet to start organizing cash, savings, cards, and debt.",
    action: (
      <Button size="sm">
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add wallet
      </Button>
    ),
  },
};

export const Transactions: Story = {
  args: {
    illustration: "transactions",
    title: "No transactions yet",
    description: "Transactions you add or import will appear here.",
    action: (
      <Button size="sm" variant="outline">
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add transaction
      </Button>
    ),
  },
};

export const Budget: Story = {
  args: {
    illustration: "budget",
    title: "No budget set up",
    description: "Plan your spending by categories to keep your finances under control.",
    action: (
      <Button size="sm">
        Set up budget
      </Button>
    ),
  },
};

export const Calendar: Story = {
  args: {
    illustration: "calendar",
    title: "No upcoming bills",
    description: "Add recurring transaction schedules to see them on the calendar.",
    action: (
      <Button size="sm" variant="outline">
        Schedule bill
      </Button>
    ),
  },
};

export const Inbox: Story = {
  args: {
    illustration: "inbox",
    title: "Your inbox is clean",
    description: "No pending imports or drafts need your attention right now.",
    action: null,
  },
};

export const Reports: Story = {
  args: {
    illustration: "reports",
    title: "No report data",
    description: "Add transactions to see cashflow trends and category breakdowns.",
    action: null,
  },
};

export const Search: Story = {
  args: {
    illustration: "search",
    title: "No results found",
    description: "Try adjusting your search queries or clearing the filters.",
    action: (
      <Button size="sm" variant="ghost">
        Clear filter
      </Button>
    ),
  },
};

