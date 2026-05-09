import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { MobileBottomNav } from "@/components/app-sidebar";
import { noopAsyncAction, storyUser, withPathname } from "@/stories/fixtures/story-data";

const PhoneFrame = ({ Story }: { Story: React.ComponentType }) => (
  <div className="relative mx-auto h-[720px] w-[390px] overflow-hidden bg-[#fafaf7]">
    <div className="absolute inset-0 overflow-y-auto px-4 pt-6 pb-32">
      <div className="mb-3 h-[200px] rounded-2xl bg-[#f0f0eb]" />
      <div className="mb-3 h-[120px] rounded-2xl bg-[#e5e4df]" />
      <div className="mb-3 h-[160px] rounded-2xl bg-[#f0f0eb]" />
      <div className="mb-3 h-[120px] rounded-2xl bg-[#e5e4df]" />
      <div className="h-[80px] rounded-2xl bg-[#f0f0eb]" />
    </div>
    <Story />
  </div>
);

const meta = {
  title: "Organisms/MobileBottomNav",
  component: MobileBottomNav,
  args: {
    user: storyUser,
    onSignOut: noopAsyncAction,
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => <PhoneFrame Story={Story} />,
  ],
} satisfies Meta<typeof MobileBottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodayActive: Story = {
  parameters: withPathname("/today"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(/open profile menu/i)).toBeInTheDocument();
  },
};

export const AccountsActive: Story = {
  parameters: withPathname("/accounts"),
};

export const BudgetActive: Story = {
  parameters: withPathname("/budget"),
};

export const InboxActive: Story = {
  parameters: withPathname("/inbox"),
};
