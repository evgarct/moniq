import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { BudgetView } from "@/features/budget/components/budget-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Budget",
  render: () => (
    <StoryWorkspace pathname="/budget">
      <div className="h-full">
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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Budget")).toBeInTheDocument();
    await expect(canvas.getByText("Expenses")).toBeInTheDocument();
    await expect(canvas.getByText("Income")).toBeInTheDocument();
  },
};
