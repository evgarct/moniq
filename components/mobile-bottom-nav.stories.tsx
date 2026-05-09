import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { MobileBottomNav } from "@/components/app-sidebar";
import { noopAsyncAction, storyUser, withPathname } from "@/stories/fixtures/story-data";

const PhoneFrame = ({ Story }: { Story: React.ComponentType }) => (
  /*
   * translate(0) → new containing block so position:fixed is scoped here.
   * The <style> tag forces the nav visible because Tailwind's lg:hidden would
   * hide it at the Storybook iframe width (>1024px).
   */
  <div
    className="relative mx-auto h-[720px] w-[390px] overflow-hidden bg-[#fafaf7]"
    style={{ transform: "translate(0)" }}
  >
    {/* eslint-disable-next-line react/no-unknown-property */}
    <style>{`[data-mobile-nav] { display: flex !important; }`}</style>
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
    viewport: { defaultViewport: "mobile1" },
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
