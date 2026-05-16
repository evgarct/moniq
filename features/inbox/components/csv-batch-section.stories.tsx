import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CsvBatchSection } from "@/features/inbox/components/csv-batch-section";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { TransactionImport, TransactionImportBatch } from "@/types/imports";

const snapshot = makeFinanceSnapshot();
const wallets = snapshot.accounts;
const categories = snapshot.categories;

const batch: TransactionImportBatch = {
  id: "csv-batch-1",
  user_id: "storybook-user",
  wallet_id: wallets[0]?.id ?? "",
  source: "csv",
  file_name: "raiffeisen-april.csv",
  imported_rows: 6,
  wallet: wallets[0] ?? null,
  created_at: new Date().toISOString(),
};

function makeTransaction(index: number): TransactionImport {
  return {
    id: `csv-transaction-${index}`,
    user_id: "storybook-user",
    batch_id: batch.id,
    wallet_id: wallets[0]?.id ?? "",
    finance_transaction_id: null,
    external_id: null,
    row_index: index,
    fingerprint: `fingerprint-${index}`,
    amount: 100 + index * 15,
    currency: wallets[0]?.currency ?? "USD",
    occurred_at: `2026-04-${String(10 + (index % 10)).padStart(2, "0")}`,
    kind: index % 4 === 0 ? "transfer" : "expense",
    counterpart_wallet_id: index % 4 === 0 ? wallets[1]?.id ?? null : null,
    merchant_raw: `RAW MERCHANT ${index}`,
    merchant_clean: `Merchant ${index}`,
    category_id: null,
    category: null,
    status: "draft",
    batch,
    wallet: wallets[0] ?? null,
    counterpart_wallet: index % 4 === 0 ? wallets[1] ?? null : null,
    finance_transaction: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const fewTransactions = Array.from({ length: 4 }, (_, index) => makeTransaction(index + 1));
const manyTransactions = Array.from({ length: 20 }, (_, index) => makeTransaction(index + 1));

const meta = {
  title: "Inbox/CsvBatchSection",
  component: CsvBatchSection,
  args: {
    batch,
    transactions: fewTransactions,
    categories,
    wallets,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof CsvBatchSection>;

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
    transactions: manyTransactions,
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
    transactions: manyTransactions,
  },
};

export const TransferHeavyBatch: Story = {
  decorators: [DesktopFrame],
  args: {
    transactions: manyTransactions.map((tx, index) => ({
      ...tx,
      kind: index % 2 === 0 ? "transfer" : "debt_payment",
      counterpart_wallet_id: wallets[1]?.id ?? null,
      counterpart_wallet: wallets[1] ?? null,
    })),
  },
};
