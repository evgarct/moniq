import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { CalendarView } from "@/features/calendar/components/calendar-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Calendar",
  render: () => (
    <StoryWorkspace pathname="/calendar">
      <div className="p-6">
        <CalendarView transactions={snapshot.transactions} />
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/calendar"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Monthly view")).toBeInTheDocument();
  },
};
