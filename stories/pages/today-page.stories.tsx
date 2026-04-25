import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { TodayView } from "@/features/today/components/today-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Today",
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-screen">
        <TodayView snapshot={snapshot} />
      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Today")).toBeInTheDocument();
    await expect(canvas.getByText("PLANNED")).toBeInTheDocument();
  },
};

/** Mobile list mode — agenda view showing all planned + today's paid transactions. */
export const MobileList: Story = {
  parameters: {
    ...withPathname("/today"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="h-screen">
        <TodayView snapshot={snapshot} />
      </div>
    </StoryWorkspace>
  ),
};
