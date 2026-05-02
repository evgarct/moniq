import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Surface } from "@/components/surface";
import { StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

function TokenSwatch({
  name,
  value,
  className,
}: {
  name: string;
  value: string;
  className: string;
}) {
  return (
    <div className="radius-floating border border-black/6 bg-white/70 p-3">
      <div className={`h-20 radius-surface border border-black/6 ${className}`} />
      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/VisualTokens",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex h-full flex-col gap-6 p-6">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Visual Tokens
            </p>
            <h1 className="type-h2">Warm neutrals carry the product. Contrast is a tool, not a style crutch.</h1>
            <p className="type-body-14 max-w-3xl text-muted-foreground">
              The palette is intentionally narrow. Most of Moniq should remain readable and expressive without leaning
              on brand-colored UI.
            </p>
          </div>
        </Surface>

        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="grid gap-4 lg:grid-cols-4">
            <TokenSwatch name="Background" value="#fafaf7" className="bg-background" />
            <TokenSwatch name="Card" value="#f0f0eb" className="bg-card" />
            <TokenSwatch name="Secondary" value="#e5e4df" className="bg-secondary" />
            <TokenSwatch name="Accent" value="#ebd8bc" className="bg-accent" />
            <TokenSwatch name="Foreground" value="#191919" className="bg-foreground" />
            <TokenSwatch name="Muted Foreground" value="#666663" className="bg-[#666663]" />
            <TokenSwatch name="Sidebar" value="#191919" className="bg-sidebar" />
            <TokenSwatch name="Destructive" value="#bf5d43" className="bg-destructive" />
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-3">
          <Surface tone="canvas" padding="lg" className="min-h-36 border border-black/5">
            <p className="type-h5">Canvas</p>
            <p className="type-body-14 mt-2 text-muted-foreground">The base workspace should stay quiet and expansive.</p>
          </Surface>
          <Surface tone="panel" padding="lg" className="min-h-36 border border-black/5">
            <p className="type-h5">Panel</p>
            <p className="type-body-14 mt-2 text-muted-foreground">Primary work areas feel brighter and gently lifted.</p>
          </Surface>
          <Surface tone="floating" padding="lg" className="min-h-36">
            <p className="type-h5">Floating</p>
            <p className="type-body-14 mt-2 text-muted-foreground">Quick tools need stronger contrast and tighter edges.</p>
          </Surface>
        </div>
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/accounts"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Visual Tokens")).toBeInTheDocument();
    await expect(canvas.getByText("Canvas")).toBeInTheDocument();
  },
};
