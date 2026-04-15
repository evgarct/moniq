import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ClaudeInboxView } from "@/features/claude-inbox/components/claude-inbox-view";
import { PageContainer } from "@/components/page-container";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

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

function ClaudeInboxPageTemplate({
  batches,
}: {
  batches: Parameters<typeof ClaudeInboxView>[0]["batches"];
}) {
  return (
    <StoryWorkspace pathname="/claude-inbox">
      <PageContainer className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Claude Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review transaction batches submitted by Claude.
          </p>
        </div>
        <ClaudeInboxView
          batches={batches}
          categories={categories}
          accounts={accounts}
        />
      </PageContainer>
    </StoryWorkspace>
  );
}

const meta = {
  title: "Pages/ClaudeInbox",
  parameters: {
    ...withPathname("/claude-inbox"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithPendingBatch: Story = {
  render: () => <ClaudeInboxPageTemplate batches={[pendingBatch]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Claude Inbox")).toBeInTheDocument();
    await expect(canvas.getByText("Тинькофф выписка апрель 2026")).toBeInTheDocument();
    await expect(canvas.getByText("Пятёрочка")).toBeInTheDocument();
  },
};

export const Mixed: Story = {
  render: () => <ClaudeInboxPageTemplate batches={[pendingBatch, approvedBatch]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Claude Inbox")).toBeInTheDocument();
    await expect(canvas.getByText("Тинькофф выписка апрель 2026")).toBeInTheDocument();
    await expect(canvas.getByText("March statement")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  render: () => <ClaudeInboxPageTemplate batches={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Claude Inbox")).toBeInTheDocument();
    await expect(canvas.getByText("Nothing pending")).toBeInTheDocument();
  },
};
