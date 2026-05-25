import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, formatISO, subDays } from "date-fns";
import { expect, within } from "storybook/test";

import { TodayView } from "@/features/today/components/today-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

const snapshot = makeMobileWindowSnapshot();
const mobileSnapshot = snapshot;

const meta = {
  title: "Pages/Today",
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-screen">
        <TodayView snapshot={snapshot} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    await expect(canvas.getAllByText("Planned").length).toBeGreaterThan(0);
  },
};

/** Mobile list mode — agenda view showing all planned + today's paid transactions. */
export const MobileList: Story = {
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-screen">
        <TodayView snapshot={snapshot} />
      </div>
    </StoryWorkspace>
  ),
};

export const MobileUpcomingWindow: Story = {
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-screen">
        <TodayView snapshot={mobileSnapshot} />
      </div>
    </StoryWorkspace>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Next 3 days" })).toBeInTheDocument();
    await expect(canvas.getAllByText("Tomorrow insurance").length).toBeGreaterThan(0);
    await expect(canvas.queryByText("Overdue transfer")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Future subscription")).not.toBeInTheDocument();
  },
};

function makeMobileWindowSnapshot(): FinanceSnapshot {
  const base = makeFinanceSnapshot();
  const template = base.transactions.find((tx) => tx.kind === "expense") ?? base.transactions[0];
  const today = new Date();
  const plannedWindow: Transaction[] = [
    makeStoryTransaction(template, "story-overdue-transfer", "Overdue transfer", subDays(today, 1)),
    makeStoryTransaction(template, "story-tomorrow-insurance", "Tomorrow insurance", addDays(today, 1)),
    makeStoryTransaction(template, "story-future-subscription", "Future subscription", addDays(today, 4)),
  ];

  return {
    ...base,
    transactions: [
      ...plannedWindow,
      ...base.transactions.filter((tx) => tx.status !== "planned"),
    ],
  };
}

function makeStoryTransaction(template: Transaction, id: string, title: string, date: Date): Transaction {
  const occurredAt = formatISO(date, { representation: "date" });

  return {
    ...template,
    id,
    title,
    occurred_at: occurredAt,
    created_at: formatISO(date),
    status: "planned",
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category_id: template.category ? `${id}-category` : null,
    category: template.category ? { ...template.category, id: `${id}-category`, name: title } : null,
    schedule: null,
  };
}
