import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { TransactionsView } from "@/features/transactions/components/transactions-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Transactions",
  render: ({ data = snapshot }: { data?: typeof snapshot }) => (
    <StoryWorkspace pathname="/transactions">
      <div className="min-h-screen p-6">
        <TransactionsView snapshot={data} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/transactions"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const CategoryWorkspace: Story = {
  args: {
    data: snapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Taxonomy")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Categories" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /Food & Home Living Costs/ }));
    await expect(canvas.getByText("Category detail")).toBeInTheDocument();
    await expect(canvas.getAllByText("Linked activity").length).toBeGreaterThan(0);
  },
};
