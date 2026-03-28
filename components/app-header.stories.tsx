import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AppHeader } from "@/components/app-header";
import { noopAsyncAction, storyUser, withPathname } from "@/stories/fixtures/story-data";

const meta = {
  title: "Organisms/AppHeader",
  component: AppHeader,
  args: {
    user: storyUser,
    onSignOut: noopAsyncAction,
  },
  decorators: [
    (Story) => (
      <div className="bg-[#fbf8f4]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AccountsHeader: Story = {
  parameters: withPathname("/accounts"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Organization Settings")).toBeInTheDocument();
  },
};
