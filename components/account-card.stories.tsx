import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AccountCard } from "@/components/account-card";
import { StoryDemoFrame, makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Molecules/AccountCard",
  component: AccountCard,
  args: {
    account: snapshot.accounts[1],
    onSelect: fn(),
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-[320px]">
        <Story />
      </StoryDemoFrame>
    ),
  ],
} satisfies Meta<typeof AccountCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Saving: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onSelect).toHaveBeenCalled();
  },
};

export const Debt: Story = {
  args: {
    account: snapshot.accounts[5],
  },
};

export const CreditCard: Story = {
  args: {
    account: snapshot.accounts[4],
  },
};
