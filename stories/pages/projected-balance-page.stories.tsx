import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, format } from "date-fns";
import { expect, userEvent, within } from "storybook/test";

import { ProjectedBalanceView } from "@/features/reports/components/projected-balance-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { ExchangeRate, Transaction } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const today = new Date();
const source = snapshot.accounts[0];
const destination = snapshot.accounts[1] ?? snapshot.accounts[0];
const storyExchangeRates: ExchangeRate[] = [
  {
    provider: "frankfurter",
    base_currency: "EUR",
    quote_currency: "CZK",
    requested_date: format(today, "yyyy-MM-dd"),
    rate_date: format(today, "yyyy-MM-dd"),
    rate: 25,
    fetched_at: today.toISOString(),
  },
  {
    provider: "frankfurter",
    base_currency: "RUB",
    quote_currency: "CZK",
    requested_date: format(today, "yyyy-MM-dd"),
    rate_date: format(today, "yyyy-MM-dd"),
    rate: 0.28,
    fetched_at: today.toISOString(),
  },
];

const plannedTransactions: Transaction[] = source && destination
  ? [
      {
        id: "projected-rent",
        user_id: source.user_id,
        title: "Rent",
        note: null,
        occurred_at: format(addDays(today, 5), "yyyy-MM-dd"),
        created_at: today.toISOString(),
        status: "planned",
        kind: "expense",
        amount: 18_000,
        destination_amount: null,
        fx_rate: null,
        principal_amount: null,
        interest_amount: null,
        extra_principal_amount: null,
        category_id: null,
        source_account_id: source.id,
        destination_account_id: null,
        schedule_id: null,
        schedule_occurrence_date: null,
        is_schedule_override: false,
        category: null,
        source_account: source,
        destination_account: null,
        schedule: null,
        allocation_id: null,
        allocation: null,
      },
      {
        id: "projected-salary",
        user_id: source.user_id,
        title: "Salary",
        note: null,
        occurred_at: format(addDays(today, 12), "yyyy-MM-dd"),
        created_at: today.toISOString(),
        status: "planned",
        kind: "income",
        amount: 52_000,
        destination_amount: null,
        fx_rate: null,
        principal_amount: null,
        interest_amount: null,
        extra_principal_amount: null,
        category_id: null,
        source_account_id: null,
        destination_account_id: source.id,
        schedule_id: null,
        schedule_occurrence_date: null,
        is_schedule_override: false,
        category: null,
        source_account: null,
        destination_account: source,
        schedule: null,
        allocation_id: null,
        allocation: null,
      },
    ]
  : [];

const reportSnapshot = {
  ...snapshot,
  transactions: [...snapshot.transactions, ...plannedTransactions],
  exchange_rates: storyExchangeRates,
};

const meta = {
  title: "Pages/ProjectedBalance",
  component: ProjectedBalanceView,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/reports/projected-balance",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectedBalanceView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    snapshot: reportSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Projected balance" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /All accounts.*6 months/ })).toBeInTheDocument();
  },
};

export const AccountPickerOpen: Story = {
  args: {
    snapshot: reportSnapshot,
    initialAccountPickerOpen: true,
  },
};

export const MobileAccountPickerOpen: Story = {
  args: {
    snapshot: reportSnapshot,
  },
  beforeEach: ({ canvasElement }) => {
    const documentRootStyle = canvasElement.ownerDocument.documentElement.style;
    const previousValue = documentRootStyle.getPropertyValue("--safe-area-inset-top");
    const previousPriority = documentRootStyle.getPropertyPriority("--safe-area-inset-top");

    documentRootStyle.setProperty("--safe-area-inset-top", "47px");

    return () => {
      if (previousValue) {
        documentRootStyle.setProperty("--safe-area-inset-top", previousValue, previousPriority);
      } else {
        documentRootStyle.removeProperty("--safe-area-inset-top");
      }
    };
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /All accounts.*6 months/ }));

    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog");
    const backButton = body.getByRole("button", { name: "Back" });

    await expect(dialog).toBeInTheDocument();
    await expect(getComputedStyle(dialog).top).toBe("47px");
    await expect(backButton.getBoundingClientRect().top).toBeGreaterThanOrEqual(47);
  },
};

export const Empty: Story = {
  args: {
    snapshot: {
      ...reportSnapshot,
      accounts: [],
      transactions: [],
    },
  },
};

export const NoPlannedTransactions: Story = {
  args: {
    snapshot: {
      ...reportSnapshot,
      transactions: reportSnapshot.transactions.filter(
        (transaction) => transaction.status !== "planned",
      ),
    },
  },
};

export const SeparateAccounts: Story = {
  args: {
    snapshot: reportSnapshot,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/reports/projected-balance",
        query: {
          merged: "false",
          account: reportSnapshot.accounts.map((account) => account.id),
        },
      },
    },
  },
};
