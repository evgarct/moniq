import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { DashboardStoryPage, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const meta = {
  title: "Pages/Dashboard",
  render: () => (
    <StoryWorkspace pathname="/dashboard">
      <DashboardStoryPage />
    </StoryWorkspace>
  ),
  parameters: withPathname("/dashboard"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Total balance")).toBeInTheDocument();
    await expect(canvas.getByText("Recent transactions")).toBeInTheDocument();
  },
};
