import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountList } from "@/components/account-list";
import { StoryDemoFrame, makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Organisms/AccountList",
  component: AccountList,
  args: {
    accounts: snapshot.accounts,
    allocations: snapshot.allocations,
    selectedAccountId: "reserve",
    onSelect: () => undefined,
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-[320px]">
        <Story />
      </StoryDemoFrame>
    ),
  ],
} satisfies Meta<typeof AccountList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Goals")).toBeInTheDocument();
    await expect(canvas.getByText("Euro Reserve")).toBeInTheDocument();
  },
};

export const Multicurrency: Story = {
  args: {
    selectedAccountId: "everyday",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Prague Everyday Card")).toBeInTheDocument();
    await expect(canvas.getByText("Travel Credit Card")).toBeInTheDocument();
  },
};
