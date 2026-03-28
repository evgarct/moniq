import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AccountTypeBadge } from "@/components/account-type-badge";

const meta = {
  title: "Atoms/AccountTypeBadge",
  component: AccountTypeBadge,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof AccountTypeBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Cash: Story = {
  args: {
    type: "cash",
  },
};

export const Saving: Story = {
  args: {
    type: "saving",
  },
};

export const CreditCard: Story = {
  args: {
    type: "credit_card",
  },
};

export const Debt: Story = {
  args: {
    type: "debt",
  },
};
