import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import { expect, within } from "storybook/test";

import { LandingView } from "@/features/landing/components/landing-view";
import enMessages from "@/messages/en.json";
import { withPathname } from "@/stories/fixtures/story-data";

const meta = {
  title: "Pages/LandingPage",
  render: () => (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="h-screen">
        <LandingView />
      </div>
    </NextIntlClientProvider>
  ),
  parameters: {
    ...withPathname("/"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("More than numbers.");
    await expect(canvas.getByRole("heading", { name: "See the month ahead." })).toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: /pricing/i })).not.toBeInTheDocument();
  },
};

export const Mobile: Story = {
  parameters: {
    ...withPathname("/"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export const Conversation: Story = {
  play: async ({ canvasElement }) => {
    const chapter = canvasElement.querySelector("#assistants");
    if (!(chapter instanceof HTMLElement)) throw new Error("Missing conversation chapter");
    chapter.closest("main")?.scrollTo({ top: chapter.offsetTop, behavior: "instant" });
    const heading = within(chapter).getByRole("heading");
    const description = chapter.querySelector("h2 + p");
    await expect(heading).toHaveStyle({ color: getComputedStyle(chapter).color });
    await expect(description).toHaveStyle({ color: getComputedStyle(chapter).color });
  },
};
