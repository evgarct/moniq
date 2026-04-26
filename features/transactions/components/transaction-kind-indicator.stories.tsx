import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TransactionKindBadge, TransactionKindIndicator } from "@/features/transactions/components/transaction-kind-badge";
import type { Transaction } from "@/types/finance";

const kinds: Transaction["kind"][] = [
  "income",
  "expense",
  "transfer",
  "debt_payment",
];

const meta = {
  title: "Atoms/TransactionKindIndicator",
  render: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <p className="type-body-12 text-muted-foreground">Row indicators</p>
        <div className="flex flex-wrap gap-3">
          {kinds.map((kind) => (
            <div key={kind} className="flex items-center gap-2">
              <TransactionKindIndicator kind={kind} />
              <span className="type-body-12 text-muted-foreground">{kind}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="type-body-12 text-muted-foreground">Badge variants</p>
        <div className="flex flex-wrap gap-3">
          {kinds.map((kind) => (
            <TransactionKindBadge key={kind} kind={kind} />
          ))}
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllKinds: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("income")).toBeInTheDocument();
    await expect(canvas.getAllByText("Transfer")[0]).toBeInTheDocument();
  },
};
