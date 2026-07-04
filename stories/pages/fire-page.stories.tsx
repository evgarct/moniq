import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { subMonths, format } from "date-fns";
import { expect, userEvent, within } from "storybook/test";

import { FireView } from "@/features/reports/components/fire-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { ExchangeRate, Transaction, InvestmentPosition } from "@/types/finance";

const snapshot = makeFinanceSnapshot();
const today = new Date();
const source = snapshot.accounts[0];

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
];

// Historical transactions in the last 12 months
const historicalTransactions: Transaction[] = source
  ? Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(today, i);
      const dateString = format(date, "yyyy-MM-dd");

      const incomeTx: Transaction = {
        id: `hist-income-${i}`,
        user_id: source.user_id,
        title: "Monthly Salary",
        note: null,
        occurred_at: dateString,
        created_at: date.toISOString(),
        status: "paid",
        kind: "income",
        amount: 60_000,
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
      };

      const expenseTx: Transaction = {
        id: `hist-expense-${i}`,
        user_id: source.user_id,
        title: "Rent & Food",
        note: null,
        occurred_at: dateString,
        created_at: date.toISOString(),
        status: "paid",
        kind: "expense",
        amount: 25_000,
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
      };

      return [incomeTx, expenseTx];
    }).flat()
  : [];

// Mock Investment stock position (Vanguard S&P 500 ETF)
const mockInstrumentPositions: InvestmentPosition[] = source
  ? [
      {
        id: "vuaa-pos",
        user_id: source.user_id,
        instrument_id: "vuaa-inst",
        opening_units: 50,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        instrument: {
          id: "vuaa-inst",
          name: "Vanguard S&P 500 UCITS ETF",
          type: "etf",
          ticker: "VUAA.DE",
          exchange: "XETRA",
          quote_currency: "EUR",
          isin: null,
          provider: "mock",
          provider_symbol: "VUAA.DE",
        },
        latest_quote: {
          instrument_id: "vuaa-inst",
          provider: "mock",
          market_date: format(today, "yyyy-MM-dd"),
          price: 98,
          currency: "EUR",
          fetched_at: today.toISOString(),
        },
      },
    ]
  : [];

const reportSnapshot = {
  ...snapshot,
  transactions: [...snapshot.transactions, ...historicalTransactions],
  exchange_rates: [...snapshot.exchange_rates, ...storyExchangeRates],
  investment_positions: mockInstrumentPositions,
};

const meta: Meta<typeof FireView> = {
  title: "Pages/FIRE Report",
  component: FireView,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/reports/fire",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof FireView>;

export const Default: Story = {
  args: {
    snapshot: reportSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify header title
    const header = await canvas.findByRole("heading", { level: 1 });
    expect(header).toHaveTextContent(/FIRE/i);

    // Verify SWR, Income, and Expenses lines are listed in the legend
    const legendIncome = await canvas.findByText(/^Income$/i);
    expect(legendIncome).toBeInTheDocument();

    const legendExpenses = await canvas.findByText(/^Expenses$/i);
    expect(legendExpenses).toBeInTheDocument();

    const legendPassive = await canvas.findByText(/Passive Income/i);
    expect(legendPassive).toBeInTheDocument();
  },
};

export const AccountPickerOpen: Story = {
  args: {
    snapshot: reportSnapshot,
    initialOpen: true,
  },
};
