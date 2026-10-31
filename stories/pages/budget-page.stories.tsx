import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { addDays, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { BudgetView } from "@/features/budget/components/budget-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { Transaction } from "@/types/finance";

const snapshot = makeFinanceSnapshot();

// Planned (not yet paid) operations for the current month, relative to today so the story never expires:
// one still ahead in Living Costs that will take it over its plan, one in Core Bills, and an overdue one when
// today is not the first day of the month.
const today = new Date();
const template = snapshot.transactions.find((transaction) => transaction.kind === "expense" && transaction.category_id && transaction.status === "paid")!;
const categoryByName = (name: string) => snapshot.categories.find((category) => category.name === name)!;
const lastDay = endOfMonth(today);
const ahead = isSameMonth(addDays(today, 3), today) ? addDays(today, 3) : lastDay;
function planned(id: string, title: string, amount: number, category: string, date: Date): Transaction {
  return {
    ...template,
    id,
    title,
    amount,
    status: "planned",
    category_id: categoryByName(category).id,
    category: categoryByName(category),
    note: null,
    occurred_at: format(date, "yyyy-MM-dd"),
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    schedule: null,
  };
}
snapshot.transactions.push(
  planned("story-planned-groceries", "Weekly groceries", 9000, "Living Costs", ahead),
  planned("story-planned-internet", "Internet", 650, "Core Bills", lastDay),
);
if (today.getDate() > 1) {
  snapshot.transactions.push(planned("story-planned-overdue", "Gym membership", 900, "Core Bills", startOfMonth(today)));
}

const meta = {
  title: "Pages/Budget",
  render: () => (
    <StoryWorkspace pathname="/budget">
      <div className="h-screen">
        <BudgetView snapshot={snapshot} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/budget"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Default: month summary + one flat row per envelope, nothing selected.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Expenses")).toBeInTheDocument();
    await expect(canvas.getAllByText("Income").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Planned")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /^Core Bills/, pressed: false })).toBeInTheDocument();
  },
};

export const GoalFunding: Story = {
  render: () => {
    const data=makeFinanceSnapshot();
    const source=data.accounts.find(account=>account.currency==="CZK")!;
    const destination={...data.accounts.find(account=>account.type==="saving")!,currency:"CZK" as const};
    const funding={...template,id:"story-funded-goal",kind:"transfer" as const,amount:3000,destination_amount:3000,status:"paid" as const,occurred_at:format(today,"yyyy-MM-dd"),source_account_id:source.id,source_account:source,destination_account_id:destination.id,destination_account:destination,allocation_id:"story-gtfo",source_allocation_id:null,category_id:"cushion"};
    data.transactions=[funding];
    data.categories=data.categories.map(category=>category.id==="next-safe"?{...category,description:"[budget: 13000]"}:category);
    return <StoryWorkspace pathname="/budget"><div className="h-full"><BudgetView snapshot={data} /></div></StoryWorkspace>;
  },
};

// Enjoy Life has a 1 000 plan in the fixture and more spend than that: it is flagged as over budget and sorted first.
export const OverBudget: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("button", { name: /Core Bills|Living Costs|Enjoy Life|Next & Safe|Wealth/ });
    await expect(rows[0]).toHaveTextContent("Enjoy Life");
    await expect(rows[0]).toHaveTextContent("over");
  },
};

// A one-month override: the month plan replaces the base, the detail says so and offers a way back to the base.
// The fixture's Enjoy Life base is 100; November-style overrides only affect the month they are set for.
export const MonthOverride: Story = {
  render: () => {
    const data = makeFinanceSnapshot();
    const enjoy = data.categories.find((category) => category.name === "Enjoy Life")!;
    data.category_budgets = [{ category_id: enjoy.id, month: format(startOfMonth(today), "yyyy-MM-dd"), scope: "month", amount: 49900 }];
    return <StoryWorkspace pathname="/budget"><div className="h-screen"><BudgetView snapshot={data} /></div></StoryWorkspace>;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Enjoy Life/, pressed: false }));
    await expect(await canvas.findByText("Changed for this month")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Restore base" })).toBeInTheDocument();
    await expect(canvas.getByLabelText("Set budget")).toHaveValue(49900);
  },
};

// Changing the plan asks where it applies: this month only, or from this month onward (earlier months keep theirs).
export const ChooseBudgetScope: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: false }));
    const input = await canvas.findByLabelText("Set budget");
    await userEvent.clear(input);
    await userEvent.type(input, "41000");
    await userEvent.tab();
    const group = await canvas.findByRole("group", { name: "Apply to" });
    await expect(within(group).getByRole("button", { name: "This month only" })).toBeInTheDocument();
    await expect(within(group).getByRole("button", { name: "This month onward" })).toBeInTheDocument();
    await userEvent.click(within(group).getByRole("button", { name: "Cancel" }));
    await expect(canvas.queryByRole("group", { name: "Apply to" })).toBeNull();
  },
};

// Desktop: click an envelope row → the right-hand panel shows plan, spend and subcategories.
export const CategoryExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: false }));
    await expect(canvas.getByText("Subcategories")).toBeInTheDocument();
    await expect(canvas.getAllByText("Loans").length).toBeGreaterThan(0);
  },
};

// Click the same row again → panel closes (toggle).
export const CategoryCollapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /^Core Bills/, pressed: false });
    await userEvent.click(row);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: true }));
    await expect(canvas.queryAllByText("Subcategories").length).toBe(0);
  },
};

// Planned operations: the summary leads with what is left at month end, envelopes show the upcoming segment
// and the upcoming list sits under the envelopes.
export const PlannedOperations: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/at month end/)).toBeInTheDocument();
    await expect(canvas.getByRole("region", { name: "Upcoming this month" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: /^Living Costs.*Prague Everyday Card/ }).length).toBe(1);
    await expect(canvas.getByRole("button", { name: /^Living Costs/, pressed: false })).toHaveTextContent("upcoming");
  },
};

// Clicking a month in the strip switches the whole page to that month; no side sheet opens.
export const MonthFromChart: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previous = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(subMonths(today, 1));
    await userEvent.click(canvas.getByRole("button", { name: `Show ${previous}` }));
    await waitFor(() => expect(canvas.getByRole("button", { name: `Show ${previous}`, pressed: true })).toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: previous })).toBeInTheDocument();
    await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
  },
};

const mobileParameters = {
  ...withPathname("/budget"),
  layout: "fullscreen",
  viewport: { defaultViewport: "mobile2" },
};

// Mobile: the rows are the whole screen; tapping one opens a fullscreen detail (portalled) with a back action.
export const MobileEnvelopeDetail: Story = {
  parameters: mobileParameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: false }));

    const screen = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(screen.getByText("Subcategories")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Budget" }));
    await waitFor(() => expect(screen.queryByText("Subcategories")).not.toBeInTheDocument());
  },
};

// Mobile detail left open: plan, spend, subcategories as flat rows and the collapsed transactions row.
export const MobileEnvelopeDetailOpen: Story = {
  parameters: mobileParameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Enjoy Life/ }));

    const screen = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(screen.getByText("Subcategories")).toBeInTheDocument());
    await expect(screen.getByRole("button", { name: /Show transactions/ })).toBeInTheDocument();
  },
};

export const MobileCategoryManagement: Story = {
  parameters: mobileParameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Manage categories" }));
    await expect(canvas.getByRole("button", { name: "Finish editing categories" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: "Add" }).length).toBeGreaterThan(0);
  },
};

export const InlineCategoryEditing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Manage categories" }));
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: false }));
    await userEvent.click(canvas.getByRole("button", { name: "Edit category" }));
    await expect(canvas.getByLabelText("Category name")).toHaveValue("Core Bills");
    await expect(canvas.getByRole("button", { name: "Icon" })).toBeInTheDocument();
  },
};
