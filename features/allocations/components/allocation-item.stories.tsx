import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AllocationItem } from "@/features/allocations/components/allocation-item";
import { makeFinanceSnapshot } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Molecules/AllocationItem",
  component: AllocationItem,
  args: {
    allocation: snapshot.allocations[0],
    currency: "USD",
    onEdit: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AllocationItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /edit goal/i }));
    await expect(args.onEdit).toHaveBeenCalled();
  },
};
