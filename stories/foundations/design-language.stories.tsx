import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { MoneyAmount } from "@/components/money-amount";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Foundations/DesignLanguage",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex h-full flex-col gap-6 p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <Surface tone="panel" padding="lg" className="border border-black/5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Design Language</p>
                <h1 className="font-heading text-4xl tracking-[-0.04em] text-slate-950">Claude-like calm, product-first finance workspace</h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  The shell, global add menu, and Balance page left panel define the current Moniq visual language.
                  New screens should inherit this restraint instead of introducing brighter or more card-heavy UI.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Surface tone="canvas" padding="md" className="border border-black/8">
                  <p className="type-h6">Canvas</p>
                  <p className="type-body-12 mt-2">Warm ivory workspace with minimal contrast and generous spacing.</p>
                </Surface>
                <Surface tone="panel" padding="md" className="border border-black/8">
                  <p className="type-h6">Panel</p>
                  <p className="type-body-12 mt-2">Rounded working regions with soft depth and clear content hierarchy.</p>
                </Surface>
                <Surface tone="floating" padding="md">
                  <p className="type-h6">Floating</p>
                  <p className="type-body-12 mt-2">Compact tool surfaces for menus, quick add, and contextual actions.</p>
                </Surface>
              </div>

              <div className="mt-6 border-t border-black/5 pt-6">
                <h2 className="type-h5 text-foreground mb-4">Core Constraints & Design Rules</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[16px] border border-black/5 bg-background/60 p-5">
                    <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      🚫 No cards. No chips. Ever.
                    </p>
                    <p className="type-body-12 mt-2 text-slate-600">
                      Do not wrap individual list items, transactions, or accounts in their own card. Repeating items live as flat rows. Never render metadata as badge/chip/pill shapes. Use plain muted text instead.
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-black/5 bg-background/60 p-5">
                    <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      📱 Mobile Safe Areas & Backgrounds
                    </p>
                    <p className="type-body-12 mt-2 text-slate-600">
                      To prevent iOS status bar and safe area color mismatches, the base background on mobile is strictly <code>bg-card</code> (#f0f0eb). Screen content and headers automatically blend with this color on mobile.
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-black/5 bg-background/60 p-5">
                    <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      📦 Surface Component is the Only Container
                    </p>
                    <p className="type-body-12 mt-2 text-slate-600">
                      Never write arbitrary rounded/shadow utilities. Use <code>Surface</code> with appropriate tones: <strong>canvas</strong> (base), <strong>panel</strong> (work regions), <strong>floating</strong> (tools/popovers).
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-black/5 bg-background/60 p-5">
                    <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      🎨 Opaque Mobile Surfaces
                    </p>
                    <p className="type-body-12 mt-2 text-slate-600">
                      Full-bleed screens (Budget, Balance, Calendar) must not wrap their top-level content in a Surface on desktop. On mobile, surfaces are full-width and opaque, blending directly with the screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <Surface tone="floating" padding="lg" className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reference Signals</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Black primary action, muted supporting copy, and warm neutral surfaces should carry most of the interface.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button>Primary action</Button>
              <Button variant="outline">Secondary action</Button>
            </div>

            <div className="rounded-[20px] border border-black/8 bg-[#f7f3ef] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Money Display</p>
              <MoneyAmount amount={124850.45} currency="CZK" display="absolute" className="mt-2 text-3xl font-semibold text-slate-950" />
            </div>
          </Surface>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-black/8 bg-[#f7f3ef] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <AccountsView
            accounts={snapshot.accounts}
            categories={snapshot.categories}
            transactions={snapshot.transactions}
            allocations={snapshot.allocations}
            investmentPositions={snapshot.investment_positions}
          />
        </div>
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/accounts"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const CanonicalBalanceWorkspace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Design Language")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Balance", level: 1 })).toBeInTheDocument();
  },
};
