import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { expect, within } from "storybook/test";

import { BalanceRegisterPanel } from "@/features/accounts/components/balance-register-panel";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();
const selectedAccount = snapshot.accounts.find((account) => account.id === "everyday") ?? snapshot.accounts[0];
const savingsAccount = snapshot.accounts.find((account) => account.id === "reserve") ?? snapshot.accounts[1];
const defaultStartDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
const defaultEndDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

const meta = {
  title: "Organisms/BalanceRegisterPanel",
  component: BalanceRegisterPanel,
  args: {
    selectedAccount,
    transactions: snapshot.transactions.filter(
      (transaction) =>
        transaction.source_account?.id === selectedAccount.id || transaction.destination_account?.id === selectedAccount.id,
    ),
    showMinorUnits: false,
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    defaultStartDate,
    onStartDateChange: () => undefined,
    onEndDateChange: () => undefined,
  },
  parameters: {
    layout: "fullscreen",
    controls: {
      disable: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[#fbf8f4] p-6">
        <div className="mx-auto min-h-[720px] max-w-4xl overflow-hidden rounded-[24px] border border-black/5 bg-[#fbf8f4]">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof BalanceRegisterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WalletFocused: Story = {
  args: {
    selectedAccount,
    transactions: snapshot.transactions.filter(
      (transaction) =>
        transaction.source_account?.id === selectedAccount.id || transaction.destination_account?.id === selectedAccount.id,
    ),
    showMinorUnits: false,
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    defaultStartDate,
    onStartDateChange: () => undefined,
    onEndDateChange: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(selectedAccount.name)[0]).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Show all wallets" })).toBeInTheDocument();
  },
};

export const SavingsFocused: Story = {
  args: {
    selectedAccount: savingsAccount,
    transactions: snapshot.transactions.filter(
      (transaction) =>
        transaction.source_account?.id === savingsAccount.id || transaction.destination_account?.id === savingsAccount.id,
    ),
    showMinorUnits: false,
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    defaultStartDate,
    onStartDateChange: () => undefined,
    onEndDateChange: () => undefined,
  },
};

export const AllTransactions: Story = {
  args: {
    selectedAccount: null,
    transactions: snapshot.transactions,
    showMinorUnits: false,
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    defaultStartDate,
    onStartDateChange: () => undefined,
    onEndDateChange: () => undefined,
  },
};
