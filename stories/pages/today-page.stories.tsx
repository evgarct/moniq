import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, formatISO, startOfToday } from "date-fns";
import { expect, within } from "storybook/test";

import { TodayView } from "@/features/today/components/today-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { Transaction } from "@/types/finance";

const today = startOfToday();

function makeTransaction(values: {
  id: string;
  title: string;
  dayOffset: number;
  status: Transaction["status"];
}): Transaction {
  const snapshot = makeFinanceSnapshot();
  const sourceAccount = snapshot.accounts[0] ?? null;

  return {
    id: values.id,
    user_id: "storybook-user",
    title: values.title,
    note: values.title,
    occurred_at: formatISO(addDays(today, values.dayOffset), { representation: "date" }),
    created_at: formatISO(addDays(today, values.dayOffset)),
    status: values.status,
    kind: "expense",
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: null,
    source_account_id: sourceAccount?.id ?? null,
    destination_account_id: null,
    allocation_id: null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category: null,
    source_account: sourceAccount,
    destination_account: null,
    allocation: null,
    schedule: null,
  };
}

function makeTodaySnapshot() {
  const snapshot = makeFinanceSnapshot();

  snapshot.transactions = [
    ...snapshot.transactions,
    makeTransaction({ id: "planned-today-story", title: "Planned today", dayOffset: 0, status: "planned" }),
    makeTransaction({ id: "planned-soon-story", title: "Planned soon", dayOffset: 3, status: "planned" }),
    makeTransaction({ id: "selected-day-planned-story", title: "Selected day planned", dayOffset: -1, status: "planned" }),
  ].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));

  return snapshot;
}

const snapshot = makeTodaySnapshot();

const meta = {
  title: "Pages/Today",
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-full">
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
    await expect(canvas.getByRole("heading", { name: "Today", level: 1 })).toBeInTheDocument();
    await expect(canvas.getByText("Completed today and planned items coming up over the next week.")).toBeInTheDocument();
    await expect(canvas.getByText("Uncategorized (Planned soon)")).toBeInTheDocument();
  },
};

export const SelectedDay: Story = {
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-full">
        <TodayView snapshot={snapshot} initialSelectedDate={addDays(today, -1)} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Transactions recorded for the selected date, with completed items before planned ones.")).toBeInTheDocument();
    await expect(canvas.getByText("Uncategorized (Selected day planned)")).toBeInTheDocument();
  },
};

export const MonthMode: Story = {
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-full">
        <TodayView snapshot={snapshot} initialSelectedDate={null} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("All planned and completed transactions in the selected month, grouped by date.")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Today" })).toBeInTheDocument();
  },
};
