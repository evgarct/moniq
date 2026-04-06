import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { StoryDemoFrame, makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { Transaction } from "@/types/finance";

const snapshot = makeFinanceSnapshot();

const byKind = (kind: Transaction["kind"]) =>
  snapshot.transactions.find((transaction) => transaction.kind === kind) ?? snapshot.transactions[0];

const curatedLedger = [
  byKind("income"),
  snapshot.transactions.find((transaction) => transaction.title === "Coffee with Alex") ?? snapshot.transactions[0],
  snapshot.transactions.find((transaction) => transaction.title === "Groceries refill") ?? snapshot.transactions[0],
  byKind("transfer"),
  byKind("save_to_goal"),
  byKind("debt_payment"),
  snapshot.transactions.find((transaction) => transaction.title === "Hotel booking") ?? snapshot.transactions[0],
];

const denseDayLedger = [
  {
    ...byKind("income"),
    id: "story-dense-income",
    occurred_at: "2026-04-06T09:12:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Coffee with Alex") ?? snapshot.transactions[0]),
    id: "story-dense-coffee",
    occurred_at: "2026-04-06T10:20:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Groceries refill") ?? snapshot.transactions[0]),
    id: "story-dense-groceries",
    occurred_at: "2026-04-06T13:10:00.000Z",
  },
  {
    ...byKind("transfer"),
    id: "story-dense-transfer",
    occurred_at: "2026-04-05T15:05:00.000Z",
  },
  {
    ...byKind("save_to_goal"),
    id: "story-dense-save",
    occurred_at: "2026-04-05T19:35:00.000Z",
  },
  {
    ...byKind("debt_payment"),
    id: "story-dense-debt",
    occurred_at: "2026-04-05T11:00:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Hotel booking") ?? snapshot.transactions[0]),
    id: "story-dense-hotel",
    occurred_at: "2026-04-04T08:40:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Coffee with Alex") ?? snapshot.transactions[0]),
    id: "story-dense-coffee-2",
    occurred_at: "2026-04-04T12:25:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Groceries refill") ?? snapshot.transactions[0]),
    id: "story-dense-groceries-2",
    occurred_at: "2026-04-04T18:05:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Car loan payment") ?? snapshot.transactions[0]),
    id: "story-dense-loan-single",
    occurred_at: "2026-04-03T09:45:00.000Z",
  },
  {
    ...(snapshot.transactions.find((transaction) => transaction.title === "Hotel booking") ?? snapshot.transactions[0]),
    id: "story-dense-hotel-single",
    occurred_at: "2026-03-31T07:30:00.000Z",
  },
];

const transferFocusedLedger = snapshot.transactions.filter((transaction) =>
  ["transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(transaction.kind),
);
const positiveMovesLedger = [
  snapshot.transactions.find((transaction) => transaction.kind === "save_to_goal") ?? snapshot.transactions[0],
  {
    ...(snapshot.transactions.find((transaction) => transaction.kind === "expense") ?? snapshot.transactions[0]),
    id: "story-positive-move-investment",
    title: "ETF portfolio top-up",
    category: {
      ...((snapshot.transactions.find((transaction) => transaction.kind === "expense") ?? snapshot.transactions[0]).category ?? {
        id: "story-investment-category",
        user_id: "storybook-user",
        name: "Investments",
        icon: null,
        type: "expense" as const,
        parent_id: null,
        created_at: new Date().toISOString(),
      }),
      name: "Investments",
    },
    category_id: "story-investment-category",
  },
];

const meta = {
  title: "Molecules/TransactionList",
  component: TransactionList,
  args: {
    transactions: curatedLedger,
    emptyMessage: "No transactions yet.",
    groupByDate: true,
  },
  parameters: {
    layout: "padded",
    controls: {
      disable: true,
    },
  },
  decorators: [(Story) => <StoryDemoFrame><Story /></StoryDemoFrame>],
} satisfies Meta<typeof TransactionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BalanceLedger: Story = {
  name: "Balance Ledger",
  args: {
    transactions: denseDayLedger,
    groupByDate: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Monthly salary")).toBeInTheDocument();
    await expect(canvas.getByText("Move cash for Moscow trip")).toBeInTheDocument();
  },
};

export const TransfersAndSavings: Story = {
  args: {
    transactions: transferFocusedLedger,
  },
};

export const WithActions: Story = {
  args: {
    transactions: curatedLedger,
    renderAction: () => (
      <Button variant="ghost" size="sm" className="rounded-md">
        Action
      </Button>
    ),
  },
};

export const MobileLedger: Story = {
  args: {
    transactions: curatedLedger,
    showMinorUnits: false,
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-[390px]">
        <Story />
      </StoryDemoFrame>
    ),
  ],
};

export const InteractiveLedger: Story = {
  args: {
    transactions: denseDayLedger,
    groupByDate: true,
    onTransactionClick: () => undefined,
  },
};

export const PositiveMoves: Story = {
  args: {
    transactions: positiveMovesLedger,
  },
};

export const BoardAgenda: Story = {
  args: {
    transactions: curatedLedger,
    groupByDate: false,
    variant: "board",
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-[24px] bg-[#173540] p-4">
        <Story />
      </div>
    ),
  ],
};

export const Empty: Story = {
  args: {
    transactions: [],
  },
};
