import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { MobileBottomNav } from "@/components/app-sidebar";
import { noopAsyncAction, storyUser, withPathname } from "@/stories/fixtures/story-data";

const PhoneFrame = ({
  Story,
  shortContent = false,
}: {
  Story: React.ComponentType;
  shortContent?: boolean;
}) => (
  <div
    className="mx-auto grid h-dvh w-[393px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background"
  >
    <style>{`[data-mobile-nav] { display: flex !important; }`}</style>
    <div className="min-h-0 overflow-y-auto px-4 pt-6">
      <div className="mb-4 px-1">
        <p className="type-body-12 text-muted-foreground">iPhone-width preview</p>
        <h1 className="type-h4">
          {shortContent ? "Everything fits without scrolling" : "Bottom navigation spacing"}
        </h1>
      </div>
      {shortContent ? (
        <div className="h-[160px] rounded-[var(--radius-surface)] bg-card" />
      ) : (
        <>
          <div className="mb-3 h-[200px] rounded-[var(--radius-surface)] bg-card" />
          <div className="mb-3 h-[120px] rounded-[var(--radius-surface)] bg-secondary" />
          <div className="mb-3 h-[160px] rounded-[var(--radius-surface)] bg-card" />
          <div className="mb-3 h-[120px] rounded-[var(--radius-surface)] bg-secondary" />
          <div className="h-[80px] rounded-[var(--radius-surface)] bg-card" />
        </>
      )}
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
    (Story, context) => (
      <PhoneFrame
        Story={Story}
        shortContent={Boolean(context.parameters.shortContent)}
      />
    ),
  ],
} satisfies Meta<typeof MobileBottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodayActive: Story = {
  parameters: withPathname("/today"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvasElement.querySelector("[data-mobile-nav] nav");
    const activeLink = canvas.getByRole("link", { name: /today/i });

    await expect(canvas.getByLabelText(/open profile menu/i)).toBeInTheDocument();
    await expect(activeLink).toHaveClass("bg-secondary");
    await expect(nav).not.toBeNull();

    const navRect = nav!.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    const verticalInset = activeRect.top - navRect.top;

    await expect(activeRect.height).toBeGreaterThanOrEqual(44);
    await expect(verticalInset).toBeGreaterThanOrEqual(5);
    await expect(navRect.bottom - activeRect.bottom).toBeGreaterThanOrEqual(5);
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

export const ShortContentWithoutOverflow: Story = {
  parameters: {
    ...withPathname("/accounts"),
    shortContent: true,
  },
};
