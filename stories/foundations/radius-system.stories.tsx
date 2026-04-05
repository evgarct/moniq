import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Surface } from "@/components/surface";
import { StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const radiusTokens = [
  {
    name: "Tight",
    variable: "--radius-tight",
    value: "0.25rem",
    usage: "Tiny indicators, inline chips, compact icon trays.",
    className: "radius-tight",
  },
  {
    name: "Control",
    variable: "--radius-control",
    value: "0.375rem",
    usage: "Buttons, toggles, row actions, interactive controls inside content areas.",
    className: "radius-control",
  },
  {
    name: "Surface",
    variable: "--radius-surface",
    value: "0.5rem",
    usage: "Cards, account rows, section blocks, default workspace surfaces.",
    className: "radius-surface",
  },
  {
    name: "Floating",
    variable: "--radius-floating",
    value: "0.75rem",
    usage: "Popovers, sheets, dropdowns, floating tools.",
    className: "radius-floating",
  },
] as const;

function RadiusCard({
  name,
  variable,
  value,
  usage,
  className,
}: {
  name: string;
  variable: string;
  value: string;
  usage: string;
  className: string;
}) {
  return (
    <div className="radius-surface border border-black/5 bg-white/70 p-4">
      <div className={`h-20 border border-black/8 bg-[#e6e1d9] ${className}`} />
      <div className="mt-4 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {variable}: {value}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">{usage}</p>
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/RadiusSystem",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex h-full flex-col gap-6 p-6">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Radius System
            </p>
            <h1 className="type-h2">Three to four variables should control nearly all rounding decisions.</h1>
            <p className="type-body-14 max-w-3xl text-muted-foreground">
              Moniq should not drift into random pills. Content controls stay tighter, surfaces stay calmer, and floating
              tools get the softest radius.
            </p>
          </div>
        </Surface>

        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {radiusTokens.map((token) => (
              <RadiusCard key={token.variable} {...token} />
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-3">
          <Surface tone="panel" padding="lg" className="radius-surface border border-black/5">
            <p className="type-h5">Surface Example</p>
            <p className="type-body-14 mt-2 text-muted-foreground">
              Main workspace blocks should usually follow the surface radius.
            </p>
          </Surface>
          <div className="radius-control border border-black/8 bg-[#ece8e1] px-4 py-3">
            <p className="type-h6">Control Example</p>
            <p className="type-body-12 mt-1">Buttons and active row states should stay tighter than cards.</p>
          </div>
          <div className="radius-floating border border-black/8 bg-background px-4 py-3 shadow-sm">
            <p className="type-h6">Floating Example</p>
            <p className="type-body-12 mt-1">Sheets, popovers and dropdowns may be the softest layer.</p>
          </div>
        </div>
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/accounts"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reference: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Radius System")).toBeInTheDocument();
    await expect(canvas.getByText("Control Example")).toBeInTheDocument();
  },
};
