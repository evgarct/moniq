import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

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

// Default: chart + category grid, nothing selected
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Expenses")).toBeInTheDocument();
    // "Income" appears as both section header and category tile — check all
    await expect(canvas.getAllByText("Income").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Core Bills")).toBeInTheDocument();
  },
};

// Click a category tile → subcategories + transactions appear inline
export const CategoryExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tile = canvas.getByText("Core Bills");
    await userEvent.click(tile);
    // Subcategory rows appear — "Loans" is a child of Core Bills only visible after expanding
    // getAllByText used because "Loans" appears in both subcategory row and transaction row
    await expect(canvas.getAllByText("Loans").length).toBeGreaterThan(0);
  },
};

// Click same tile again → panel closes (toggle)
export const CategoryCollapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tile = canvas.getByText("Core Bills");
    await userEvent.click(tile);
    await userEvent.click(tile);
    // After collapse, subcategory rows disappear
    await expect(canvas.queryAllByText("Loans").length).toBe(0);
  },
};
