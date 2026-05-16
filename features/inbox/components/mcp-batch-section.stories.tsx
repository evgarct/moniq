import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { McpBatchSection } from "@/features/inbox/components/mcp-batch-section";
import type { McpBatch } from "@/features/inbox/hooks/use-mcp-batches";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();
const accounts = snapshot.accounts;
const categories = snapshot.categories;

const baseBatch: McpBatch = {
  id: "mcp-batch-1",
  status: "pending",
  source_description: "Raiffeisen screenshot · Apr 19",
  submitted_by: "storybook",
  created_at: new Date().toISOString(),
  mcp_batch_items: [
    {
      id: "mcp-item-1",
      title: "North Cafe",
      amount: 394,
      occurred_at: "2026-04-17",
      kind: "expense",
      currency: "CZK",
      note: null,
      suggested_category_name: "Food",
      status: "pending",
      resolved_category_id: null,
      resolved_account_id: accounts[0]?.id ?? null,
      resolved_destination_account_id: null,
      finance_transaction_id: null,
    },
    {
      id: "mcp-item-2",
      title: "Salary",
      amount: 120000,
      occurred_at: "2026-04-15",
      kind: "income",
      currency: "RUB",
      note: null,
      suggested_category_name: "Salary",
      status: "pending",
      resolved_category_id: null,
      resolved_account_id: accounts[0]?.id ?? null,
      resolved_destination_account_id: null,
      finance_transaction_id: null,
    },
  ],
};

const denseBatch: McpBatch = {
  ...baseBatch,
  id: "mcp-batch-dense",
  source_description: "Dense inbox batch",
  mcp_batch_items: Array.from({ length: 18 }, (_, index) => ({
    ...baseBatch.mcp_batch_items[0],
    id: `mcp-item-dense-${index + 1}`,
    title: `Draft transaction ${index + 1}`,
    amount: 80 + index * 7,
    occurred_at: `2026-04-${String(10 + (index % 9)).padStart(2, "0")}`,
  })),
};

const approvedBatch: McpBatch = {
  ...baseBatch,
  id: "mcp-batch-approved",
  status: "approved",
  mcp_batch_items: baseBatch.mcp_batch_items.map((item) => ({
    ...item,
    status: "approved",
  })),
};

const meta = {
  title: "Inbox/McpBatchSection",
  component: McpBatchSection,
  args: {
    batch: baseBatch,
    categories,
    accounts,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof McpBatchSection>;

export default meta;

type Story = StoryObj<typeof meta>;

const DesktopFrame = (Story: React.ComponentType) => (
  <div className="mx-auto h-[620px] max-w-3xl">
    <Story />
  </div>
);

export const Default: Story = {
  decorators: [DesktopFrame],
};

export const DenseScrollList: Story = {
  decorators: [DesktopFrame],
  args: {
    batch: denseBatch,
  },
};

export const MobileDenseScrollList: Story = {
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto h-dvh max-w-[390px] bg-background p-3">
        <Story />
      </div>
    ),
  ],
  args: {
    batch: denseBatch,
  },
};

export const FinalizedBatch: Story = {
  decorators: [DesktopFrame],
  args: {
    batch: approvedBatch,
  },
};
