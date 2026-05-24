import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { GoalFormSheet } from "@/features/goals/components/goal-form-sheet";
import type { WalletAllocation } from "@/types/finance";

const targetedGoal: WalletAllocation = {
  id: "goal-travel-fund",
  user_id: "storybook-user",
  wallet_id: "wallet-savings",
  name: "Travel fund",
  kind: "goal_targeted",
  amount: 1200,
  target_amount: 3000,
  created_at: "2026-04-01T10:00:00.000Z",
  updated_at: "2026-04-20T10:00:00.000Z",
};

const meta = {
  title: "Organisms/GoalFormSheet",
  component: GoalFormSheet,
  args: {
    open: true,
    mode: "add",
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof GoalFormSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AddGoal: Story = {};

export const EditTargetedGoal: Story = {
  args: {
    mode: "edit",
    allocation: targetedGoal,
  },
};
