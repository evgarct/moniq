import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef } from "react";
import { NextIntlClientProvider } from "next-intl";
import { expect, userEvent, within } from "storybook/test";

import { LandingView } from "@/features/landing/components/landing-view";
import { ImmersiveHero } from "@/features/landing/components/immersive-hero";
import { BrandHeader } from "@/features/landing/components/brand-header";
import brand from "@/features/landing/components/brand.module.css";
import immersive from "@/features/landing/components/immersive.module.css";
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
    a11y: { test: "error" },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("More than numbers.");
    await expect(canvas.getAllByRole("link", { name: /get started/i })[0]).toHaveAttribute("href", "/en/signup");
    await expect(canvas.queryByRole("link", { name: /pricing/i })).not.toBeInTheDocument();
  },
};

// Opening is reviewed at full fidelity before the rest of the journey.
function OpeningScene() {
  const page = useRef<HTMLElement>(null);
  return <main ref={page} className={`${brand.page} ${immersive.page}`}><section className={immersive.masthead}><BrandHeader showLogin /></section><ImmersiveHero scrollRef={page} /></main>;
}

export const Opening: Story = {
  render: () => <NextIntlClientProvider locale="en" messages={enMessages}><OpeningScene /></NextIntlClientProvider>,
};

export const Mobile: Story = {
  parameters: {
    ...withPathname("/"),
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export const Perspective: Story = {
  play: async ({ canvasElement }) => {
    const chapter = canvasElement.querySelector("#perspective");
    if (!(chapter instanceof HTMLElement)) throw new Error("Missing perspective chapter");
    chapter.closest("main")?.scrollTo({ top: chapter.offsetTop, behavior: "instant" });
    await expect(within(chapter).getByRole("heading")).toBeInTheDocument();
  },
};

export const ProductInteraction: Story = {
  play: async ({ canvasElement }) => {
    const chapter = canvasElement.querySelector("#product");
    if (!(chapter instanceof HTMLElement)) throw new Error("Missing product chapter");
    chapter.scrollIntoView({ behavior: "instant" });
    const canvas = within(chapter);
    await userEvent.click(canvas.getByRole("button", { name: /Savings/ }));
    await expect(canvas.getByRole("button", { name: /Savings/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.queryByText(enMessages.landing.product.rows.groceries.title)).not.toBeInTheDocument();
    await expect(canvas.getByText(enMessages.landing.product.rows.journey.title)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Everyday/ }));
    await expect(canvas.getByText(enMessages.landing.product.rows.groceries.title)).toBeInTheDocument();
    await expect(canvas.queryByText(enMessages.landing.product.rows.journey.title)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /All accounts/ }));
    await expect(canvas.getByText(enMessages.landing.product.rows.journey.title)).toBeInTheDocument();
  },
};

export const Balance: Story = {
  play: async ({ canvasElement }) => { canvasElement.querySelector("#balance")?.scrollIntoView({ behavior: "instant" }); },
};

export const Freedom: Story = {
  play: async ({ canvasElement }) => { canvasElement.querySelector("#freedom")?.scrollIntoView({ behavior: "instant" }); },
};

export const ReducedMotion: Story = {
  parameters: { chromatic: { disableSnapshot: false } },
  decorators: [(Story) => <><style>{`main [data-scene] { scroll-margin-top: 88px; } @media (prefers-reduced-motion: no-preference) { main [data-scene="opening"], main [data-scene="perspective"] { height: auto; } main [data-scene="opening"] > section, main [data-scene="perspective"] > section { position: relative; top: 0; } main [data-scene] figure, main [data-scene] section, main [data-scene] span { transform: none !important; animation: none !important; clip-path: none !important; } }`}</style><Story /></>],
};
