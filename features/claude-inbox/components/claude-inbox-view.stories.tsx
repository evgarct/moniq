import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ClaudeInboxView } from "./claude-inbox-view";
import { makeFinanceSnapshot, StoryDemoFrame } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const categories = snapshot.categories;
const accounts = snapshot.accounts;

const pendingBatch = {
  id: "batch-1",
  status: "pending" as const,
  source_description: "Тинькофф выписка апрель 2026",
  submitted_by: "claude",
  created_at: "2026-04-14T10:00:00Z",
  mcp_batch_items: [
    {
      id: "item-1",
      title: "Пятёрочка",
      amount: 2340,
      occurred_at: "2026-04-13T18:22:00Z",
      kind: "expense" as const,
      currency: "RUB",
      note: null,
      suggested_category_name: "Groceries",
      status: "pending" as const,
      resolved_category_id: null,
      resolved_account_id: null,
      finance_transaction_id: null,
    },
    {
      id: "item-2",
      title: "Salary April",
      amount: 150000,
      occurred_at: "2026-04-10T09:00:00Z",
      kind: "income" as const,
      currency: "RUB",
      note: "Monthly salary",
      suggested_category_name: "Salary",
      status: "pending" as const,
      resolved_category_id: null,
      resolved_account_id: null,
      finance_transaction_id: null,
    },
    {
      id: "item-3",
      title: "Netflix",
      amount: 799,
      occurred_at: "2026-04-12T00:00:00Z",
      kind: "expense" as const,
      currency: "RUB",
      note: null,
      suggested_category_name: "Subscriptions",
      status: "pending" as const,
      resolved_category_id: null,
      resolved_account_id: null,
      finance_transaction_id: null,
    },
  ],
};

const approvedBatch = {
  id: "batch-2",
  status: "approved" as const,
  source_description: "March statement",
  submitted_by: "claude",
  created_at: "2026-03-31T12:00:00Z",
  mcp_batch_items: [
    {
      id: "item-4",
      title: "Supermarket",
      amount: 85.5,
      occurred_at: "2026-03-30T17:00:00Z",
      kind: "expense" as const,
      currency: "EUR",
      note: null,
      suggested_category_name: "Groceries",
      status: "approved" as const,
      resolved_category_id: categories[0]?.id ?? null,
      resolved_account_id: accounts[0]?.id ?? null,
      finance_transaction_id: "txn-123",
    },
  ],
};

const rejectedBatch = {
  id: "batch-3",
  status: "rejected" as const,
  source_description: "Duplicate upload",
  submitted_by: "claude",
  created_at: "2026-04-01T08:00:00Z",
  mcp_batch_items: [
    {
      id: "item-5",
      title: "Кофе",
      amount: 320,
      occurred_at: "2026-04-01T08:30:00Z",
      kind: "expense" as const,
      currency: "RUB",
      note: null,
      suggested_category_name: null,
      status: "rejected" as const,
      resolved_category_id: null,
      resolved_account_id: null,
      finance_transaction_id: null,
    },
  ],
};

const meta = {
  title: "Features/ClaudeInbox/ClaudeInboxView",
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-2xl">
        <Story />
      </StoryDemoFrame>
    ),
  ],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <ClaudeInboxView batches={[]} categories={categories} accounts={accounts} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nothing pending")).toBeInTheDocument();
  },
};

export const PendingBatch: Story = {
  render: () => (
    <ClaudeInboxView
      batches={[pendingBatch]}
      categories={categories}
      accounts={accounts}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Тинькофф выписка апрель 2026")).toBeInTheDocument();
    await expect(canvas.getByText("Пятёрочка")).toBeInTheDocument();
    await expect(canvas.getByText("Salary April")).toBeInTheDocument();
  },
};

export const ApprovedBatch: Story = {
  render: () => (
    <ClaudeInboxView
      batches={[approvedBatch]}
      categories={categories}
      accounts={accounts}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("March statement")).toBeInTheDocument();
    await expect(canvas.getByText("Approved")).toBeInTheDocument();
  },
};

export const RejectedBatch: Story = {
  render: () => (
    <ClaudeInboxView
      batches={[rejectedBatch]}
      categories={categories}
      accounts={accounts}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Duplicate upload")).toBeInTheDocument();
    await expect(canvas.getByText("Rejected")).toBeInTheDocument();
  },
};

const longBatch = {
  id: "batch-long",
  status: "pending" as const,
  source_description: "Long batch — scroll test",
  submitted_by: "claude",
  created_at: "2026-04-18T10:00:00Z",
  mcp_batch_items: Array.from({ length: 12 }, (_, i) => ({
    id: `long-item-${i}`,
    title: ["Пятёрочка", "Netflix", "Uber", "Salary", "Amazon", "Кофе", "Gym"][i % 7],
    amount: (i + 1) * 500,
    occurred_at: `2026-04-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    kind: (["expense", "expense", "expense", "income", "expense", "expense", "expense"] as const)[i % 7],
    currency: "RUB",
    note: null,
    suggested_category_name: null,
    status: "pending" as const,
    resolved_category_id: null,
    resolved_account_id: null,
    resolved_destination_account_id: null,
    finance_transaction_id: null,
  })),
};

export const LongBatch: Story = {
  name: "Long batch — scroll inside panel",
  render: () => (
    <ClaudeInboxView
      batches={[longBatch]}
      categories={categories}
      accounts={accounts}
    />
  ),
};

export const MultipleBatches: Story = {
  render: () => (
    <ClaudeInboxView
      batches={[pendingBatch, approvedBatch, rejectedBatch]}
      categories={categories}
      accounts={accounts}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Тинькофф выписка апрель 2026")).toBeInTheDocument();
    await expect(canvas.getByText("March statement")).toBeInTheDocument();
    await expect(canvas.getByText("Duplicate upload")).toBeInTheDocument();
  },
};
