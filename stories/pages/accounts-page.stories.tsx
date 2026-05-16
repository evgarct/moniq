import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, format, formatISO, subDays } from "date-fns";
import { expect, userEvent, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { Account, Transaction, WalletAllocation } from "@/types/finance";

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
      <div className="h-full">
        <AccountsView
          accounts={data.accounts}
          categories={data.categories}
          transactions={data.transactions}
          allocations={data.allocations ?? []}
        />
      </div>
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
    const creditCardButton = canvas
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Travel Credit Card") && button.textContent?.includes("Available"));
    expect(creditCardButton).toBeDefined();
    await userEvent.click(creditCardButton!);
    await expect(canvas.getByRole("heading", { name: "Travel Credit Card", level: 3 })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Show all wallets" })).toBeInTheDocument();
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

export const MobileLeftPanelScroll: Story = {
  args: {
    data: scrollSnapshot,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Balance", level: 1 })).toBeInTheDocument();
    await expect(canvas.getByText("Cash 1")).toBeInTheDocument();
  },
};

function makeOpeningBalanceData() {
  const snap = makeFinanceSnapshot();
  const wallet = snap.accounts[0];
  const adjustmentCategory = snap.categories.find((c) => c.type === "income") ?? snap.categories[0];

  const baseBalanceTx = {
    user_id: wallet.user_id,
    note: null,
    kind: "income" as const,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    status: "paid" as const,
    category_id: adjustmentCategory.id,
    category: adjustmentCategory,
    source_account_id: null,
    source_account: null,
    destination_account_id: wallet.id,
    destination_account: wallet,
    allocation_id: null,
    allocation: null,
    schedule_id: null,
    schedule: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
  };

  const openingTx: Transaction = {
    ...baseBalanceTx,
    id: "opening-balance-1",
    title: "Opening balance",
    amount: wallet.balance,
    occurred_at: format(subDays(new Date(), 4), "yyyy-MM-dd"),
    created_at: formatISO(subDays(new Date(), 4)),
  };

  const adjustTx: Transaction = {
    ...baseBalanceTx,
    id: "balance-adjustment-1",
    title: "Balance adjustment",
    amount: 5000,
    occurred_at: format(subDays(new Date(), 3), "yyyy-MM-dd"),
    created_at: formatISO(subDays(new Date(), 3)),
  };

  return { ...snap, transactions: [openingTx, adjustTx, ...snap.transactions] };
}

export const WithOpeningBalance: Story = {
  args: {
    data: makeOpeningBalanceData(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const walletButton = canvas.getAllByRole("button").find((b) => b.textContent?.includes("Prague Everyday Card"));
    if (walletButton) await userEvent.click(walletButton);
    await expect(canvas.getByRole("heading", { name: "Prague Everyday Card", level: 3 })).toBeInTheDocument();
  },
};

function makeGoalsData() {
  const snap = makeFinanceSnapshot();
  const savingsWallet = snap.accounts.find((a) => a.type === "saving")!;

  const allocations: WalletAllocation[] = [
    {
      id: "goal-rent",
      user_id: savingsWallet.user_id,
      wallet_id: savingsWallet.id,
      name: "Rent next month",
      kind: "goal_open",
      amount: 28500,
      target_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "goal-vacation",
      user_id: savingsWallet.user_id,
      wallet_id: savingsWallet.id,
      name: "Summer vacation",
      kind: "goal_targeted",
      amount: 45000,
      target_amount: 120000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return { ...snap, allocations };
}

export const WithGoals: Story = {
  args: {
    data: makeGoalsData(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const savingsBtn = canvas.getAllByRole("button").find((b) => b.textContent?.includes("Euro Reserve"));
    if (savingsBtn) await userEvent.click(savingsBtn);
    await expect(canvas.getByText("Rent next month")).toBeInTheDocument();
    await expect(canvas.getByText("Summer vacation")).toBeInTheDocument();
    await expect(canvas.getAllByText("Free").length).toBeGreaterThan(0);
  },
};
