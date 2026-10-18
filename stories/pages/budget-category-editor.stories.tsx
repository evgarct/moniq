import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { BudgetInlineCategoryEditor } from "@/features/budget/components/budget-inline-category-editor";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();
const expenseRoot = snapshot.categories.find((category) => category.type === "expense" && category.parent_id === null)!;

const meta = {
  title: "Pages/Budget/Category editor",
  render: (args) => (
    <div className="max-w-2xl bg-background">
      <BudgetInlineCategoryEditor
        category={args.category}
        categories={snapshot.categories}
        initialType="expense"
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    </div>
  ),
  args: { category: null },
} satisfies Meta<{ category: typeof expenseRoot | null }>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A spending envelope: the switch is off, so goal transfers are only reserves. */
export const SpendingEnvelope: Story = {
  args: { category: { ...expenseRoot, is_contribution: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("switch")).not.toBeChecked();
  },
};

/** A savings/investment envelope: the switch is on and can be toggled. */
export const ContributionEnvelope: Story = {
  args: { category: { ...expenseRoot, is_contribution: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch");
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
  },
};
