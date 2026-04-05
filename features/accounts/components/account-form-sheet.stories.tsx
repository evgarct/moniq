import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Organisms/AccountFormSheet",
  component: AccountFormSheet,
  args: {
    open: true,
    mode: "add",
    initialType: "cash",
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AccountFormSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AddWallet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("combobox")[1]!);
    await expect(canvas.getByText("Primary currencies")).toBeInTheDocument();
  },
};

export const EditWallet: Story = {
  args: {
    mode: "edit",
    account: snapshot.accounts[0],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("combobox")[1]!);
    await expect(canvas.getByText("CZK")).toBeInTheDocument();
    await expect(canvas.getByText("Other major currencies")).toBeInTheDocument();
  },
};

export const CreditCardWallet: Story = {
  args: {
    mode: "edit",
    account: snapshot.accounts[4],
  },
};
