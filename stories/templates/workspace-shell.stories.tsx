import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const meta = {
  title: "Templates/WorkspaceShell",
  render: () => (
    <StoryWorkspace pathname="/today">
      <div className="min-h-screen p-6">
        <div className="rounded-xl bg-[#fbf8f4] p-6">
          <p className="type-body-12 text-muted-foreground">Workspace shell</p>
          <h1 className="type-h2 mt-2">Content slot</h1>
          <p className="type-body-14 mt-2 text-muted-foreground">
            Use this template for full-page stories that need the real app navigation and page canvas.
          </p>
        </div>
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
    await expect(canvas.getByText("Workspace shell")).toBeInTheDocument();
    await expect(canvas.getByText("Content slot")).toBeInTheDocument();
  },
};
