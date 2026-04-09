import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { PageContainer } from "@/components/page-container";
import { BudgetView } from "@/features/budget/components/budget-view";
import { TransactionsView } from "@/features/transactions/components/transactions-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Budget",
  render: () => (
    <StoryWorkspace pathname="/budget">
      <PageContainer className="flex h-full flex-col gap-6">
          <BudgetView snapshot={snapshot} />
          <TransactionsView snapshot={snapshot} basePath="/budget" />
      </PageContainer>
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
    await expect(canvas.getByRole("heading", { name: "Budget", level: 1 })).toBeInTheDocument();
    await expect(
      canvas.getByText("Expense categories with this month's completed activity."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Income categories with this month's completed activity."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Record expenses, income, transfers, savings moves, and debt payments in one register."),
    ).toBeInTheDocument();
  },
};
