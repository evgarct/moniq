import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TodayView } from "@/features/today/components/today-view";
import { makeFinanceSnapshot, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Today",
  render: () => (
    <div className="min-h-screen bg-[#0f2530] p-6">
      <TodayView snapshot={snapshot} />
    </div>
  ),
  parameters: withPathname("/today"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Planned")).toBeInTheDocument();
  },
};
