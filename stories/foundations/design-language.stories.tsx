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
                <div className="rounded-[22px] border border-black/8 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Canvas</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Warm ivory workspace with minimal contrast and generous spacing.</p>
                </div>
                <div className="rounded-[22px] border border-black/8 bg-[#f7f3ef] p-4">
                  <p className="text-sm font-semibold text-slate-950">Panel</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Rounded working regions with soft depth and clear content hierarchy.</p>
                </div>
                <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                  <p className="text-sm font-semibold text-slate-950">Floating</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Compact tool surfaces for menus, quick add, and contextual actions.</p>
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
          <AccountsView accounts={snapshot.accounts} allocations={snapshot.allocations} transactions={snapshot.transactions} />
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
