import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useTranslations } from "next-intl";

import { ImportDetailSheet } from "@/features/banking/components/banking-view";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";
import type { TransactionImport } from "@/types/imports";

const snapshot = makeFinanceSnapshot();
const wallet = snapshot.accounts[0] ?? null;

const transaction: TransactionImport = {
  id: "banking-review-transaction",
  user_id: "storybook-user",
  batch_id: "banking-review-batch",
  wallet_id: wallet?.id ?? "",
  finance_transaction_id: null,
  external_id: null,
  row_index: 1,
  fingerprint: "banking-review-fingerprint",
  amount: 128.4,
  currency: wallet?.currency ?? "CZK",
  occurred_at: "2026-04-12",
  kind: "expense",
  counterpart_wallet_id: null,
  merchant_raw: "RAW CAFE PURCHASE",
  merchant_clean: "Cafe purchase",
  category_id: null,
  category: null,
  status: "draft",
  batch: null,
  wallet,
  counterpart_wallet: null,
  finance_transaction: null,
  created_at: "2026-04-12T10:00:00Z",
  updated_at: "2026-04-12T10:00:00Z",
};

function OpenImportDetailSheet() {
  const t = useTranslations("imports");
  const commonT = useTranslations("common.actions");

  return (
    <ImportDetailSheet
      transaction={transaction}
      open
      t={t}
      commonT={commonT}
      onOpenChange={() => {}}
      onPatch={async () => {}}
    />
  );
}

const meta = {
  title: "Features/Banking/ImportDetailSheet",
  component: OpenImportDetailSheet,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OpenImportDetailSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};
