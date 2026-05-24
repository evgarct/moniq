import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CategoryFormSheet } from "@/features/categories/components/category-form-sheet";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Organisms/CategoryFormSheet",
  component: CategoryFormSheet,
  args: {
    open: true,
    mode: "add",
    categories: snapshot.categories,
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CategoryFormSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AddCategory: Story = {
};

export const EditCategory: Story = {
  args: {
    mode: "edit",
    category: snapshot.categories[0],
  },
};
