import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountList } from "@/components/account-list";
import { Surface } from "@/components/surface";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

function PrincipleBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="radius-surface bg-background/80 p-4">
      <p className="type-h5">{title}</p>
      <p className="type-body-14 mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}

const meta = {
  title: "Foundations/BalancePanelPatterns",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex min-h-screen flex-col gap-6 p-6">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Balance Panel Contract</p>
              <h1 className="type-h2">Balance is the canonical inventory surface for finance structure.</h1>
              <p className="type-body-14 max-w-3xl text-muted-foreground">
                Use this reference when changing the left side of Balance or when building any new screen that
                lists accounts, goals, or account-like inventory. New work should inherit these spacing,
                hierarchy, and state rules instead of inventing new card patterns.
              </p>
            </div>

            <div className="grid gap-3">
              <PrincipleBlock
                title="Group rhythm"
                body="Section spacing is larger than row spacing. The eye should find Cash, Goals, Credit Cards, and Debt before it reads any row."
              />
              <PrincipleBlock
                title="Row language"
                body="Rows stay quiet: neutral hover, no border-led states, tight amount-plus-currency alignment, and no duplicate type labels when the group already provides context."
              />
              <PrincipleBlock
                title="Extensions"
                body="Savings subgroups are lightweight children without filled background states. Credit cards may add one thin track, but they still inherit the base row structure."
              />
              <PrincipleBlock
                title="Mobile follow-up"
                body="On mobile, Balance shows the inventory panel first. Register activity opens as a full-screen follow-up surface with a back action."
              />
            </div>
          </div>
        </Surface>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Surface tone="panel" padding="md" className="border border-black/5">
            <div className="space-y-4">
              <div className="px-1.5">
                <p className="type-body-12 text-muted-foreground">Canonical Left Panel</p>
                <h2 className="type-h3">Account inventory</h2>
              </div>
              <AccountList
                accounts={snapshot.accounts}
                allocations={snapshot.allocations}
                selectedAccountId="travel-credit"
                selectedAllocationId="travel"
                onSelect={() => undefined}
                onSelectAllocation={() => undefined}
              />
            </div>
          </Surface>

          <Surface tone="panel" padding="lg" className="border border-black/5">
            <div className="grid gap-4 md:grid-cols-2">
              <PrincipleBlock
                title="Savings track rule"
                body="Savings subgroup tracks start on the same vertical axis as the subgroup label. They do not inherit card hover fills."
              />
              <PrincipleBlock
                title="Credit card rule"
                body="The thin credit-card track equals the full limit; the filled portion equals available money to spend. Debt appears once in the main row."
              />
              <PrincipleBlock
                title="Header controls"
                body="Title, info trigger, and icon controls are compact and aligned. Header controls follow the same quiet neutral state language as the rows below."
              />
              <PrincipleBlock
                title="Sidebar consistency"
                body="Primary navigation and profile entry use the same icon size, radius, tooltip scale, and active-state language."
              />
            </div>
          </Surface>
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
    await expect(canvas.getByText("Balance Panel Contract")).toBeInTheDocument();
    await expect(canvas.getByText("Canonical Left Panel")).toBeInTheDocument();
    await expect(canvas.getByText("Travel Credit Card")).toBeInTheDocument();
  },
};
