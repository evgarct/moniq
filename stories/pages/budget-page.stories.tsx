import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { BudgetView } from "@/features/budget/components/budget-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

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
    await expect(canvas.getByRole("button", { name: /^Core Bills/ })).toBeInTheDocument();
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

// Desktop: click an envelope row → the right-hand panel shows plan, spend and subcategories.
export const CategoryExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/ }));
    await expect(canvas.getByText("Subcategories")).toBeInTheDocument();
    await expect(canvas.getAllByText("Loans").length).toBeGreaterThan(0);
  },
};

// Click the same row again → panel closes (toggle).
export const CategoryCollapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /^Core Bills/ });
    await userEvent.click(row);
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/, pressed: true }));
    await expect(canvas.queryAllByText("Subcategories").length).toBe(0);
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
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/ }));

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
    await userEvent.click(canvas.getByRole("button", { name: /^Core Bills/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Edit category" }));
    await expect(canvas.getByLabelText("Category name")).toHaveValue("Core Bills");
    await expect(canvas.getByRole("button", { name: "Icon" })).toBeInTheDocument();
  },
};
