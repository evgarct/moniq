import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

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
};

export const EditWallet: Story = {
  args: {
    mode: "edit",
    account: snapshot.accounts[0],
  },
};

export const CreditCardWallet: Story = {
  args: {
    mode: "edit",
    account: snapshot.accounts[4],
  },
};

export const PensionWallet: Story = {
  args: { mode: "edit", account: { ...snapshot.accounts[0], type: "pension", name: "Doplňkové penzijní spoření (DPS)", currency: "CZK", balance: 229294.06 } },
};
