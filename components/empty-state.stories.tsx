import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  args: {
    title: "No wallets yet",
    description: "Create your first wallet to start organizing cash, savings, cards, and debt.",
    action: <Button>Add wallet</Button>,
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
