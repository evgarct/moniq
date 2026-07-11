import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";

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

export const Desktop: Story = {};

export const Mobile: Story = {
  parameters: {
    ...withPathname("/"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};
