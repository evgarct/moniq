import type { Meta, StoryObj } from "@storybook/nextjs-vite";

type ResultItem = {
  title: string;
  amount: number;
  occurred_at: string;
  kind: string;
  status?: string;
  currency?: string | null;
};

function McpResultWidgetStory({
  title,
  message,
  counts,
  items,
}: {
  title: string;
  message: string;
  counts: Record<string, number>;
  items: ResultItem[];
}) {
  return (
    <div className="max-w-md bg-background p-4 text-foreground">
      <section className="rounded-[var(--radius-surface)] border border-border/60 bg-background p-3">
        <p className="type-body-12 mb-1 font-semibold text-muted-foreground uppercase">
          Moniq
        </p>
        <h1 className="text-base leading-snug font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{message}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(counts).map(([key, value]) => (
            <span key={key}>
              {key.replaceAll("_", " ")}: {value}
            </span>
          ))}
        </div>
        <div className="mt-3 border-t border-border/60">
          {items.map((item) => (
            <div key={`${item.title}-${item.occurred_at}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border/40 py-2 last:border-b-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.kind, item.occurred_at, item.status].filter(Boolean).join(" - ")}
                </p>
              </div>
              <p className="text-right text-xs font-medium tabular-nums">
                {item.amount.toLocaleString()} {item.currency}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Inbox/McpResultWidget",
  component: McpResultWidgetStory,
  args: {
    title: "Batch submitted",
    message: "Batch submitted successfully. 2 transactions are now in the Moniq Claude Inbox for review.",
    counts: { submitted: 2, pending: 2 },
    items: [
      { title: "North Cafe", amount: 394, occurred_at: "2026-04-17", kind: "expense", status: "pending", currency: "CZK" },
      { title: "Salary", amount: 120000, occurred_at: "2026-04-15", kind: "income", status: "pending", currency: "RUB" },
    ],
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof McpResultWidgetStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SubmitResult: Story = {};

export const UpdateResult: Story = {
  args: {
    title: "Draft updated",
    message: "Updated draft transaction in Moniq Inbox.",
    counts: { updated: 1 },
    items: [
      { title: "North Cafe corrected", amount: 410, occurred_at: "2026-04-17", kind: "expense", status: "pending", currency: "CZK" },
    ],
  },
};

export const SoftDeleteResult: Story = {
  args: {
    title: "Draft rejected",
    message: "Rejected draft transaction in Moniq Inbox.",
    counts: { deleted: 1 },
    items: [
      { title: "Duplicate row", amount: 410, occurred_at: "2026-04-17", kind: "expense", status: "rejected", currency: "CZK" },
    ],
  },
};

export const HardDeleteResult: Story = {
  args: {
    title: "Draft deleted",
    message: "Deleted draft transaction from Moniq Inbox.",
    counts: { deleted: 1 },
    items: [
      { title: "Wrong screenshot row", amount: 99, occurred_at: "2026-04-18", kind: "expense", status: "pending", currency: "EUR" },
    ],
  },
};
