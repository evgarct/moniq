import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, formatISO } from "date-fns";
import { expect, userEvent, within } from "storybook/test";

import { PageContainer } from "@/components/page-container";
import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { Account, Transaction } from "@/types/finance";

const snapshot = makeFinanceSnapshot();

function makeScrollableAccounts(baseAccounts: Account[]) {
  const extraCash: Account[] = Array.from({ length: 8 }, (_, index) => ({
    ...baseAccounts[0],
    id: `cash-extra-${index + 1}`,
    name: `Cash ${index + 1}`,
    balance: 18000 + index * 925,
    created_at: formatISO(addDays(new Date(), -(index + 20))),
  }));

  const extraSavings: Account[] = Array.from({ length: 5 }, (_, index) => ({
    ...baseAccounts[1],
    id: `saving-extra-${index + 1}`,
    name: `Reserve ${index + 1}`,
    balance: 4200 + index * 360,
    created_at: formatISO(addDays(new Date(), -(index + 40))),
  }));

  const extraCredit: Account[] = Array.from({ length: 4 }, (_, index) => ({
    ...baseAccounts[4],
    id: `credit-extra-${index + 1}`,
    name: `Credit ${index + 1}`,
    balance: -2400 - index * 780,
    created_at: formatISO(addDays(new Date(), -(index + 60))),
  }));

  const extraDebt: Account[] = Array.from({ length: 3 }, (_, index) => ({
    ...baseAccounts[5],
    id: `debt-extra-${index + 1}`,
    name: `Debt ${index + 1}`,
    balance: -83000 - index * 12500,
    created_at: formatISO(addDays(new Date(), -(index + 80))),
  }));

  return [...baseAccounts, ...extraCash, ...extraSavings, ...extraCredit, ...extraDebt];
}

function makeScrollableTransactions(baseTransactions: Transaction[], baseAccounts: Account[]) {
  const sourceAccount = baseAccounts.find((account) => account.id === "everyday") ?? baseAccounts[0];
  const category = baseTransactions.find((transaction) => transaction.category)?.category ?? null;

  const extras = Array.from({ length: 24 }, (_, index) => ({
    ...baseTransactions[1],
    id: `scroll-transaction-${index + 1}`,
    title: `Dense transaction ${index + 1}`,
    occurred_at: formatISO(addDays(new Date(), -(index % 12)), { representation: "date" }),
    created_at: formatISO(addDays(new Date(), -(index % 12))),
    amount: 90 + index * 11,
    source_account_id: sourceAccount.id,
    source_account: sourceAccount,
    destination_account_id: null,
    destination_account: null,
    category_id: category?.id ?? null,
    category,
    allocation_id: null,
    allocation: null,
    status: "paid" as const,
  }));

  return [...extras, ...baseTransactions].sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
}

const scrollSnapshot = {
  ...snapshot,
  accounts: makeScrollableAccounts(snapshot.accounts),
  transactions: makeScrollableTransactions(snapshot.transactions, snapshot.accounts),
};

const meta = {
  title: "Pages/Balance",
  render: ({ data = snapshot }: { data?: typeof snapshot }) => (
    <StoryWorkspace pathname="/accounts">
      <PageContainer className="h-full px-0 py-0 sm:px-0">
        <AccountsView
          accounts={data.accounts}
          allocations={data.allocations}
          categories={data.categories}
          transactions={data.transactions}
        />
      </PageContainer>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/accounts"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: snapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Euro Reserve")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Balance", level: 1 })).toBeInTheDocument();
    await expect(canvas.getByText("Transactions")).toBeInTheDocument();
  },
};

export const MulticurrencyWallets: Story = {
  args: {
    data: snapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Prague Everyday Card")[0]).toBeInTheDocument();
    await expect(canvas.getAllByText("Ruble Debit Card")[0]).toBeInTheDocument();
  },
};

export const Editing: Story = {
  args: {
    data: snapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add wallet" }));
    await expect(canvas.getAllByLabelText(/Add .* wallet/)[0]).toBeInTheDocument();
  },
};

export const CreditCardFocused: Story = {
  args: {
    data: snapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Travel Credit Card/i }));
    await expect(canvas.getByRole("heading", { name: "Travel Credit Card", level: 3 })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Show all wallets" })).toBeInTheDocument();
    await expect(canvas.getByText("Hotel booking")).toBeInTheDocument();
  },
};

export const DenseScroll: Story = {
  args: {
    data: scrollSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cash 1")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Balance", level: 1 })).toBeInTheDocument();
  },
};
