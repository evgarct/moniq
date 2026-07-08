import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Surface } from "@/components/surface";
import { StoryWorkspace } from "@/stories/fixtures/story-data";

const meta = {
  title: "Foundations/Branding",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto">
        {/* Header Block */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Branding & Identity
            </p>
            <h1 className="type-h2">A tactile, linocut print language for PWA and favicon assets.</h1>
            <p className="type-body-14 max-w-3xl text-muted-foreground">
              Moniq uses a cohesive, hand-drawn design language. All brand assets share wobbly, organic vector paths,
              creamy off-white cutout fills, and bold black ink lines, set against a warm terracotta background.
            </p>
          </div>
        </Surface>

        {/* Brand Mark Section */}
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <Surface tone="panel" padding="lg" className="border border-black/5 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-32 h-32 rounded-3xl overflow-hidden border border-black/10 shadow-sm bg-white p-2 flex items-center justify-center">
              <img src="/moniq-mark.svg" alt="Moniq SVG Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold">Core Logo Mark</p>
              <p className="text-xs text-muted-foreground">moniq-mark.svg (Vector)</p>
            </div>
          </Surface>

          <Surface tone="panel" padding="lg" className="border border-black/5 space-y-4">
            <h2 className="type-h5">Design System Details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border border-black/5 p-3 rounded-lg bg-background">
                <div className="h-10 rounded-md bg-[#cc785c] mb-2" />
                <p className="text-xs font-semibold">Terracotta Background</p>
                <p className="font-mono text-[10px] text-muted-foreground">#cc785c (--chart-1)</p>
              </div>
              <div className="border border-black/5 p-3 rounded-lg bg-background">
                <div className="h-10 rounded-md bg-[#fafaf7] mb-2 border border-black/10" />
                <p className="text-xs font-semibold">Cream Cutout Fill</p>
                <p className="font-mono text-[10px] text-muted-foreground">#fafaf7 (--background)</p>
              </div>
              <div className="border border-black/5 p-3 rounded-lg bg-background">
                <div className="h-10 rounded-md bg-[#191919] mb-2" />
                <p className="text-xs font-semibold">Ink Outline Color</p>
                <p className="font-mono text-[10px] text-muted-foreground">#191919 (--primary)</p>
              </div>
            </div>
            <p className="type-body-12 text-muted-foreground leading-normal">
              The symbol represents a balance scale, aligning with the core financial concept of budgeting and balance.
              The shapes are drawn with imperfect wobbly vectors to convey a tactile, human-crafted linocut print feel.
            </p>
          </Surface>
        </div>

        {/* PWA & iOS Assets Section */}
        <Surface tone="panel" padding="lg" className="border border-black/5 space-y-6">
          <div>
            <h2 className="type-h4 font-serif">PWA & iOS Application Assets</h2>
            <p className="type-body-12 text-muted-foreground">
              These assets are automatically compiled for PWA splash screens, install icons, and the iOS Home Screen.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Apple Touch Icon */}
            <div className="border border-black/5 p-4 rounded-xl bg-background flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-black/10 shadow-xs">
                <img src="/apple-touch-icon.png" alt="Apple Touch Icon" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold">Apple Touch Icon</p>
                <p className="text-[10px] text-muted-foreground">180 x 180 (iOS Home Screen)</p>
              </div>
            </div>

            {/* PWA Icon 192 */}
            <div className="border border-black/5 p-4 rounded-xl bg-background flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-black/10 shadow-xs">
                <img src="/icon-192.png" alt="PWA Icon 192" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold">PWA App Icon</p>
                <p className="text-[10px] text-muted-foreground">192 x 192 (PWA Install)</p>
              </div>
            </div>

            {/* PWA Icon 512 */}
            <div className="border border-black/5 p-4 rounded-xl bg-background flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-black/10 shadow-xs">
                <img src="/icon-512.png" alt="PWA Icon 512" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold">PWA Splash Icon</p>
                <p className="text-[10px] text-muted-foreground">512 x 512 (PWA Load Screen)</p>
              </div>
            </div>

            {/* Maskable Icon */}
            <div className="border border-black/5 p-4 rounded-xl bg-background flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border border-black/10 shadow-xs">
                <img src="/icon-maskable-512.png" alt="Maskable Icon" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold">Maskable Icon</p>
                <p className="text-[10px] text-muted-foreground">512 x 512 (Opaque, Croppable)</p>
              </div>
            </div>
          </div>
        </Surface>

        {/* Maintenance Guide */}
        <Surface tone="panel" padding="lg" className="border border-black/5 space-y-4">
          <h2 className="type-h5">Branding Assets Maintenance</h2>
          <div className="type-body-12 text-muted-foreground space-y-2">
            <p>
              Favicon and PWA icons are generated directly from the source SVG file located at{" "}
              <code>public/moniq-mark.svg</code>.
            </p>
            <p className="font-semibold text-foreground">To update the icons in the future:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Edit the SVG vectors in <code>public/moniq-mark.svg</code>.</li>
              <li>
                Run the local generation script to automatically refresh all sizes:
                <pre className="mt-1.5 p-2 bg-muted text-foreground font-mono text-[11px] rounded-md border overflow-x-auto">
                  node scripts/generate-pwa-icons.mjs
                </pre>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              Note: The generator uses Playwright to capture pixel-perfect exports, preserving transparent backgrounds for standard icons and opaque bounds for maskable icons.
            </p>
          </div>
        </Surface>
      </div>
    </StoryWorkspace>
  ),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Visual verification hook
    await expect(canvas.getByText("Branding & Identity")).toBeDefined();
  },
};
