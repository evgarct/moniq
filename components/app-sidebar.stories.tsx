import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AppSidebar } from "@/components/app-sidebar";
import { noopAsyncAction, storyUser, withPathname } from "@/stories/fixtures/story-data";

const meta = {
  title: "Organisms/AppSidebar",
  component: AppSidebar,
  args: {
    user: storyUser,
    onSignOut: noopAsyncAction,
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-[88px] overflow-hidden bg-[#ece8e4]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AccountsActive: Story = {
  parameters: withPathname("/accounts"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(/open profile menu/i)).toBeInTheDocument();
  },
};
