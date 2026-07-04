import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";

import { AccountRow } from "@/components/account-row";
import { StoryDemoFrame, makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Molecules/AccountRow",
  component: AccountRow,
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
} satisfies Meta<typeof AccountRow>;

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

export const ContextActions: Story = {
  args: {
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.contextMenu(canvas.getByRole("button"));
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText("Edit wallet")).toBeInTheDocument();
    await expect(body.getByText("Delete wallet")).toBeInTheDocument();
  },
};
