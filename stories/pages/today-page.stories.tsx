import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { PageContainer } from "@/components/page-container";
import { TodayView } from "@/features/today/components/today-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Pages/Today",
  render: () => (
    <StoryWorkspace pathname="/today">
      <PageContainer className="h-full">
        <TodayView snapshot={snapshot} />
      </PageContainer>
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
    await expect(canvas.getByText("Planned")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Today", level: 1 })).toBeInTheDocument();
  },
};
