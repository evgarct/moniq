import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  ArrowLeft,
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
import { StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { CurrencyCode } from "@/types/currency";

// ─── Shared primitives used throughout this playbook ─────────────────────────

function SectionHeader({
  eyebrow,
  heading,
  sub,
}: {
  eyebrow: string;
  heading: string;
  sub?: string;
}) {
  return (
    <div className="space-y-1.5 px-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="type-h3">{heading}</h2>
      {sub && <p className="type-body-14 max-w-2xl text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RuleCard({
  label,
  body,
  variant = "neutral",
}: {
  label: string;
  body: string;
  variant?: "neutral" | "do" | "dont";
}) {
  const accent =
    variant === "do"
      ? "border-l-[3px] border-l-green-500/60"
      : variant === "dont"
        ? "border-l-[3px] border-l-destructive/60"
        : "";
  return (
    <div className={`radius-surface bg-background/80 p-4 ${accent}`}>
      <p className="type-h6">
        {variant === "do" && (
          <span className="mr-1.5 text-green-600">✓</span>
        )}
        {variant === "dont" && (
          <span className="mr-1.5 text-destructive">✕</span>
        )}
        {label}
      </p>
      <p className="type-body-12 mt-1.5">{body}</p>
    </div>
  );
}

function DemoRow({
  icon: Icon,
  label,
  sub,
  amount,
  currency = "CZK",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  sub?: string;
  amount: number;
  currency?: CurrencyCode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-secondary/50">
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="type-h6 truncate">{label}</p>
        {sub && <p className="type-body-12 truncate">{sub}</p>}
      </div>
      <MoneyAmount
        amount={amount}
        currency={currency}
        display="absolute"
        className="shrink-0 text-sm font-medium tabular-nums"
      />
    </div>
  );
}

// ─── Story ────────────────────────────────────────────────────────────────────

const meta = {
  title: "Foundations/UIPlaybook",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex min-h-screen flex-col gap-8 p-6">

        {/* ── 1. Screen anatomy ─────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              UI Playbook
            </p>
            <h1 className="type-h2">
              Every new screen starts here.
            </h1>
            <p className="type-body-14 max-w-3xl text-muted-foreground">
              This page is the single reference for how Moniq screens are assembled. Before building
              anything new, check whether a pattern here already covers it. The Balance page is the
              canonical example of the full system working together.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <RuleCard
              label="Calm, not empty"
              body="Generous spacing reads as confidence. Every screen should feel like there is room to breathe — not like content is missing."
              variant="do"
            />
            <RuleCard
              label="Warm neutrals first"
              body="Background, card, and secondary cover 95% of the surface area. Brand color or bright UI should be an exception, not a default."
              variant="do"
            />
            <RuleCard
              label="No one-off card shapes"
              body="Do not invent new border-radius or shadow values. Use radius-tight / control / surface / floating. The system must not drift."
              variant="dont"
            />
          </div>
        </Surface>

        {/* ── 2. Section header pattern ─────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Section Header"
              heading="Eyebrow → Heading → Supporting copy"
              sub="Every major content block opens with this three-line anchor. Eyebrow is ALL-CAPS 12px tracked. Heading uses type-h2 or type-h3 depending on context depth. Supporting copy is optional — only add it when the section needs orientation."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[16px] border border-black/6 bg-background/60 p-5">
                <SectionHeader
                  eyebrow="Page title"
                  heading="This is a page-level heading (type-h2)"
                  sub="Used once per page, usually inside the top Surface. Adds optional body copy when the user needs orientation."
                />
              </div>
              <div className="rounded-[16px] border border-black/6 bg-background/60 p-5">
                <SectionHeader
                  eyebrow="Section label"
                  heading="This is a section heading (type-h3)"
                />
                <p className="type-body-12 mt-3 text-muted-foreground">
                  Supporting copy is omitted here. Sub-sections rarely need explanation — let the content speak.
                </p>
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 3. Surface stack ──────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Surface Stack"
              heading="Canvas → Panel → Floating"
              sub="Three tones, three depths. Never skip a level or add extra shadow tiers. The workspace sits on canvas, work regions on panel, tools on floating."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <Surface tone="canvas" padding="lg" className="min-h-36 border border-black/5">
                <p className="type-h6">Canvas</p>
                <p className="type-body-12 mt-1.5">bg-background · no shadow · base workspace layer</p>
                <p className="type-body-12 mt-3 text-muted-foreground">
                  Page backgrounds, inert wrappers, sidebar content areas.
                </p>
              </Surface>
              <Surface tone="panel" padding="lg" className="min-h-36 border border-black/5">
                <p className="type-h6">Panel</p>
                <p className="type-body-12 mt-1.5">bg-card · inset top highlight · primary work area</p>
                <p className="type-body-12 mt-3 text-muted-foreground">
                  Content sections, account list, transaction register, dashboards.
                </p>
              </Surface>
              <Surface tone="floating" padding="lg" className="min-h-36">
                <p className="type-h6">Floating</p>
                <p className="type-body-12 mt-1.5">bg-popover · border · drop shadow · tool layer</p>
                <p className="type-body-12 mt-3 text-muted-foreground">
                  Dropdowns, quick-add menus, popovers, contextual sheets.
                </p>
              </Surface>
            </div>
          </div>
        </Surface>

        {/* ── 4. Two-panel layout ───────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Two-Panel Layout"
              heading="Left inventory + Right register"
              sub="The Balance page uses this layout. Any screen that lists items on the left and shows activity or detail on the right should follow this exact grid. Left min-width 280px, right takes remaining space."
            />

            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              {/* Left */}
              <Surface tone="panel" padding="md" className="border border-black/5">
                <div className="space-y-4">
                  <div className="px-1">
                    <p className="type-body-12 text-muted-foreground">Left panel</p>
                    <h3 className="type-h5">Inventory</h3>
                  </div>
                  <div className="space-y-1">
                    <p className="type-body-12 px-1 text-muted-foreground">Cash</p>
                    <DemoRow icon={BanknoteArrowDown} label="Everyday Wallet" amount={38450} />
                    <p className="type-body-12 px-1 pt-2 text-muted-foreground">Savings</p>
                    <DemoRow icon={PiggyBank} label="Emergency Fund" amount={85200} />
                    <p className="type-body-12 px-1 pt-2 text-muted-foreground">Credit Cards</p>
                    <DemoRow icon={CreditCard} label="Travel Card" amount={-4800} />
                    <p className="type-body-12 px-1 pt-2 text-muted-foreground">Debt</p>
                    <DemoRow icon={Landmark} label="Mortgage" amount={-1240000} />
                  </div>
                </div>
              </Surface>

              {/* Right */}
              <Surface tone="panel" padding="md" className="border border-black/5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div>
                      <p className="type-body-12 text-muted-foreground">Right panel</p>
                      <h3 className="type-h5">Register / Detail</h3>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
                      <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                      Show all
                    </Button>
                  </div>
                  <EmptyState
                    title="Select an account"
                    description="Choose a wallet or goal on the left to see transactions here."
                  />
                </div>
              </Surface>
            </div>
          </div>
        </Surface>

        {/* ── 5. Row language ───────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Row Language"
              heading="Rows are quiet. The group does the talking."
              sub="Row items never carry borders, filled backgrounds, or duplicate labels. Hover is a subtle bg-secondary/50. Amount + currency align right with tabular-nums. Icon is always outline, 18px, muted-foreground."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="type-body-12 mb-2 px-1 text-muted-foreground">Correct — quiet rows</p>
                <div className="rounded-[16px] border border-black/5 bg-background/60 p-3">
                  <p className="type-body-12 mb-2 px-1 text-muted-foreground">Cash</p>
                  <DemoRow icon={BanknoteArrowDown} label="Everyday Wallet" sub="CZK" amount={38450} />
                  <DemoRow icon={BanknoteArrowDown} label="Reserve Cash" sub="EUR · €1,200" amount={30240} />
                  <p className="type-body-12 mb-2 mt-3 px-1 text-muted-foreground">Savings</p>
                  <DemoRow icon={PiggyBank} label="Emergency Fund" sub="Target: 100,000 CZK" amount={85200} />
                </div>
              </div>

              <div className="space-y-3">
                <RuleCard
                  label="Icon: inline outline at 18px"
                  body="BanknoteArrowDown · PiggyBank · CreditCard · Landmark. strokeWidth={1.75}. Color: text-muted-foreground. Never fill, never chip, never badge."
                  variant="do"
                />
                <RuleCard
                  label="No type label inside row"
                  body="The group heading ('Cash', 'Savings') provides context. Do not repeat account type as text or badge inside the row itself."
                  variant="dont"
                />
                <RuleCard
                  label="Amount: tabular-nums, right-aligned"
                  body="Always use tabular-nums for amounts so columns align. Currency follows the number at smaller size or muted color."
                  variant="do"
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 6. Button placement ───────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Actions"
              heading="Primary action is black. Secondary is outline. Destructive is contained."
              sub="Button placement follows the surface level: page-level actions go in the panel header, row-level actions appear on hover. Never use more than one primary button per surface."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="type-body-12 mb-2 text-muted-foreground">Surface header with action</p>
                  <div className="flex items-center justify-between rounded-[16px] border border-black/5 bg-background/60 px-4 py-3">
                    <div>
                      <p className="type-h6">Wallets</p>
                      <p className="type-body-12">6 accounts</p>
                    </div>
                    <Button size="sm">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add wallet
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="type-body-12 mb-2 text-muted-foreground">Paired actions (confirm / cancel)</p>
                  <div className="flex gap-2 rounded-[16px] border border-black/5 bg-background/60 px-4 py-3">
                    <Button>Save changes</Button>
                    <Button variant="outline">Cancel</Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <RuleCard
                  label="One primary per surface"
                  body="If two actions both feel primary, the UX needs to be simplified. Demote one to outline or remove it."
                  variant="do"
                />
                <RuleCard
                  label="Black = commit. Outline = escape."
                  body="Primary (black fill) moves forward. Outline/ghost backs out or is secondary. Destructive gets its own treatment — never just make a button red."
                  variant="do"
                />
                <RuleCard
                  label="No icon-only buttons without tooltip"
                  body="Icon-only controls must have an aria-label and a visible tooltip. Ambiguous icons erode trust in a finance product."
                  variant="dont"
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 7. Money display ──────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Money Display"
              heading="Numbers are the product. Treat them with respect."
              sub="Use MoneyAmount for all currency values. Never format amounts manually. Hero numbers use font-semibold at large size. Table/row amounts use text-sm tabular-nums."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[20px] border border-black/8 bg-[#f7f3ef] p-5">
                <p className="type-body-12 text-muted-foreground">Hero amount (balance, total)</p>
                <MoneyAmount
                  amount={124850.45}
                  currency="CZK"
                  display="absolute"
                  className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-foreground"
                />
                <p className="type-body-12 mt-2 text-muted-foreground">text-[32px] font-semibold · absolute</p>
              </div>

              <div className="rounded-[20px] border border-black/8 bg-[#f7f3ef] p-5">
                <p className="type-body-12 text-muted-foreground">Signed amount (transaction)</p>
                <div className="mt-2 space-y-1">
                  <MoneyAmount
                    amount={-2400}
                    currency="CZK"
                    display="signed"
                    className="block text-xl font-medium tabular-nums text-destructive"
                  />
                  <MoneyAmount
                    amount={8500}
                    currency="CZK"
                    display="signed"
                    className="block text-xl font-medium tabular-nums text-foreground"
                  />
                </div>
                <p className="type-body-12 mt-2 text-muted-foreground">text-xl tabular-nums · signed</p>
              </div>

              <div className="rounded-[20px] border border-black/8 bg-[#f7f3ef] p-5">
                <p className="type-body-12 text-muted-foreground">Row amount (list, register)</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="type-body-14">Everyday Wallet</span>
                    <MoneyAmount
                      amount={38450}
                      currency="CZK"
                      display="absolute"
                      className="text-sm font-medium tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="type-body-14">Travel Card</span>
                    <MoneyAmount
                      amount={-4800}
                      currency="CZK"
                      display="absolute"
                      className="text-sm font-medium tabular-nums text-muted-foreground"
                    />
                  </div>
                </div>
                <p className="type-body-12 mt-2 text-muted-foreground">text-sm tabular-nums · absolute</p>
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 8. Empty states ───────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Empty States"
              heading="Empty is not broken. Make it useful."
              sub="Every list or register needs an empty state. Use EmptyState component. Title should orient; description should tell the user what to do next. Include an action button only when the user can immediately fix the emptiness."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="type-body-12 mb-2 text-muted-foreground">No selection</p>
                <EmptyState
                  title="No account selected"
                  description="Choose a wallet from the list to see its transactions."
                />
              </div>
              <div>
                <p className="type-body-12 mb-2 text-muted-foreground">No data yet</p>
                <EmptyState
                  title="No transactions yet"
                  description="Transactions you add or import will appear here."
                  action={
                    <Button size="sm" variant="outline">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add transaction
                    </Button>
                  }
                />
              </div>
              <div>
                <p className="type-body-12 mb-2 text-muted-foreground">Filtered, no results</p>
                <EmptyState
                  title="No results for this period"
                  description="Try a wider date range or clear the filter."
                  action={
                    <Button size="sm" variant="ghost">
                      Clear filter
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 9. Spacing cheat sheet ────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Spacing"
              heading="Sections breathe. Rows stay compact."
              sub="Use gap-6–8 between major Surface blocks. Use gap-4–5 between sections inside a Surface. Use gap-2–3 between rows. Never collapse section spacing to row spacing — the eye uses that contrast to find groups."
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6">
                    <th className="pb-3 text-left font-medium text-foreground">Context</th>
                    <th className="pb-3 text-left font-medium text-foreground">Token</th>
                    <th className="pb-3 text-left font-mono text-xs font-medium text-muted-foreground">Value</th>
                    <th className="pb-3 text-left font-medium text-foreground">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/4">
                  {[
                    { ctx: "Page-level sections", token: "gap-6 / gap-8", val: "24–32px", ex: "Between Surface blocks on a page" },
                    { ctx: "Inside Surface", token: "gap-4 / gap-5", val: "16–20px", ex: "Between header + content, or two content groups" },
                    { ctx: "Between rows", token: "gap-1 / gap-2", val: "4–8px", ex: "Account rows, transaction rows, list items" },
                    { ctx: "Surface padding", token: "p-3 / p-4 / p-5", val: "12–20px", ex: "sm / md / lg via Surface padding prop" },
                    { ctx: "Row padding (hover target)", token: "px-2 py-2.5", val: "8×10px", ex: "DemoRow, AccountRow, TransactionRow" },
                    { ctx: "Section group gap", token: "gap-3", val: "12px", ex: "Between group label and first row" },
                  ].map(({ ctx, token, val, ex }) => (
                    <tr key={ctx}>
                      <td className="py-3 font-medium text-foreground">{ctx}</td>
                      <td className="py-3 font-mono text-xs text-foreground">{token}</td>
                      <td className="py-3 text-muted-foreground">{val}</td>
                      <td className="py-3 text-muted-foreground">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Surface>

        {/* ── 10. No cards. No chips. ──────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="The most important rule"
              heading="No cards per item. No chips for metadata."
              sub="Every AI coding tool defaults to card-per-item and badge-per-tag. Moniq explicitly does not. Items live as rows inside a shared surface. Metadata is plain muted text."
            />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Wrong */}
              <div>
                <p className="type-body-12 mb-3 font-semibold text-destructive">✕ Wrong — card-per-item + chips</p>
                <div className="space-y-2">
                  {[
                    { label: "Grocery Store", cat: "Food", amount: "-340 CZK" },
                    { label: "Monthly Salary", cat: "Income", amount: "+52 000 CZK" },
                    { label: "Netflix", cat: "Subscriptions", amount: "-299 CZK" },
                  ].map(({ label, cat, amount }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <span className="mt-0.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            {cat}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{amount}</span>
                    </div>
                  ))}
                </div>
                <p className="type-body-12 mt-2 text-muted-foreground">
                  Card per row · icon in colored circle · category as filled chip
                </p>
              </div>

              {/* Right */}
              <div>
                <p className="type-body-12 mb-3 font-semibold text-green-600">✓ Correct — quiet rows, plain text</p>
                <div className="rounded-[16px] border border-black/5 bg-background/60 p-2">
                  {[
                    { label: "Grocery Store", cat: "Food", amount: -340 },
                    { label: "Monthly Salary", cat: "Income", amount: 52000 },
                    { label: "Netflix", cat: "Subscriptions", amount: -299 },
                  ].map(({ label, cat, amount }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-secondary/50"
                    >
                      <Wallet className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <div className="min-w-0 flex-1">
                        <p className="type-h6 truncate">{label}</p>
                        <p className="type-body-12 truncate">{cat}</p>
                      </div>
                      <MoneyAmount
                        amount={amount}
                        currency="CZK"
                        display="signed"
                        className={`shrink-0 text-sm font-medium tabular-nums ${amount < 0 ? "text-muted-foreground" : "text-foreground"}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="type-body-12 mt-2 text-muted-foreground">
                  Flat rows · icon inline outline · category as plain muted text
                </p>
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 11. Transaction kinds ─────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Transaction Kinds"
              heading="Four kinds. One visual weight — except income."
              sub="Moniq has exactly four transaction kinds: expense, income, transfer, debt_payment. Only income amounts render in emerald (positive). All others use foreground or muted. Kind is communicated by icon + sublabel text, never by a colored badge on every row."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="type-body-12 mb-2 px-1 text-muted-foreground">How kinds appear in a list</p>
                <div className="rounded-[16px] border border-black/5 bg-background/60 p-2">
                  {[
                    { Icon: BanknoteArrowDown, label: "Grocery Store", sub: "Expense · Food", amount: 1240, positive: false },
                    { Icon: BanknoteArrowUp,   label: "Monthly Salary", sub: "Income · Salary", amount: 52000, positive: true },
                    { Icon: ArrowLeftRight,    label: "To Emergency Fund", sub: "Transfer", amount: 5000, positive: false },
                    { Icon: Landmark,          label: "Mortgage payment", sub: "Debt payment", amount: 8500, positive: false },
                  ].map(({ Icon, label, sub, amount, positive }) => (
                    <div key={label} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-secondary/50">
                      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <div className="min-w-0 flex-1">
                        <p className="type-h6 truncate">{label}</p>
                        <p className="type-body-12 truncate text-muted-foreground">{sub}</p>
                      </div>
                      <MoneyAmount
                        amount={amount}
                        currency="CZK"
                        display="absolute"
                        tone={positive ? "positive" : "default"}
                        className="shrink-0 text-sm font-medium tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <RuleCard
                  label="Income = emerald. Others = neutral."
                  body="Only income uses tone='positive' (text-emerald-600). Expense, transfer, and debt_payment use tone='default' or text-muted-foreground. Red is for errors — never for expense."
                  variant="do"
                />
                <RuleCard
                  label="Kind communicated by icon + sublabel"
                  body="BanknoteArrowDown = expense, BanknoteArrowUp = income, ArrowLeftRight = transfer, Landmark = debt_payment. These icons + the category or account sublabel are sufficient — no colored chip needed."
                  variant="do"
                />
                <RuleCard
                  label="No colored kind badges in lists"
                  body="The transaction form header may show a kind badge. But in transaction rows inside a register or list, the kind badge adds visual noise without information gain."
                  variant="dont"
                />
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 12. Forms as sheets ───────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Forms"
              heading="Forms are sheets. Not dialogs, not center modals."
              sub="Structured data entry (transactions, accounts, categories) slides in as a sheet — full-screen on mobile, side panel on desktop. Dialog is reserved for confirmations (yes/no). Never use a center modal for a form with more than two fields."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <RuleCard
                  label="<Sheet> for forms, <Dialog> for confirms"
                  body="Sheet slides in from the side and feels spacious. Dialog forces a decision. Mixing them breaks the user's spatial model of the app."
                  variant="do"
                />
                <RuleCard
                  label="Kind selector at the top of the sheet"
                  body="Transaction kind is a <Select> dropdown in the sheet header — not horizontal tabs. Tabs waste vertical space on mobile and create layout shift when switching."
                  variant="do"
                />
                <RuleCard
                  label="Reschedule overlay uses fixed, not relative"
                  body="RescheduleConfirmOverlay uses fixed inset-0 z-50. Never add relative to SheetContent — it breaks the sheet's height layout and cuts off the overlay."
                  variant="do"
                />
              </div>

              {/* Sheet anatomy mock */}
              <div className="overflow-hidden rounded-[var(--radius-floating)] border border-black/8 bg-background shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BanknoteArrowDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="type-h6">Add transaction</span>
                  </div>
                  <div className="flex h-7 items-center rounded-[var(--radius-control)] border border-border/40 px-2.5 type-body-12 text-muted-foreground">
                    Expense ▾
                  </div>
                </div>
                <div className="space-y-2.5 px-4 py-4">
                  {["Amount", "Category", "Account", "Date", "Note"].map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <span className="type-body-12 text-muted-foreground">{field}</span>
                      <div className="h-9 rounded-[var(--radius-control)] border border-border/60 bg-background/60" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-border/40 px-4 py-3">
                  <Button size="sm" className="flex-1">Save</Button>
                  <Button size="sm" variant="outline">Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        {/* ── 14. Interaction polish ─────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Pattern · Interaction Polish"
              heading="Small controls still need deliberate motion and real hit areas."
              sub="These details keep dense finance UI feeling precise without making it twitchy, hard to tap, or expensive to animate."
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[16px] border border-black/5 bg-background/60 p-3">
                <div className="flex items-center justify-between rounded-[var(--radius-control)] px-2 py-2 transition-[background-color] hover:bg-secondary/50">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <BanknoteArrowDown className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <p className="type-body-14 truncate font-medium">Card payment</p>
                      <p className="type-body-12 truncate">Prague Everyday Card</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-10 rounded-[var(--radius-control)] text-muted-foreground hover:bg-secondary"
                      aria-label="Edit row"
                    >
                      <ArrowLeftRight className="size-4" />
                    </Button>
                    <MoneyAmount
                      amount={-1240}
                      currency="CZK"
                      display="signed"
                      className="text-sm font-medium tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <RuleCard
                  label="Hit areas are at least 40px"
                  body="Dense row actions may look quiet, but the interactive target must be size-10 or have a non-overlapping pseudo hit area. Never ship size-5 or size-6 click targets."
                  variant="do"
                />
                <RuleCard
                  label="Press scale is exactly 0.96"
                  body="Buttons use active:scale-[0.96] for tactile feedback. Use a static escape hatch only when scale would distract from the interaction."
                  variant="do"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <RuleCard
                label="No transition-all"
                body="Transitions must name the changing properties: transition-[background-color,color,border-color,box-shadow] or transition-[width,background-color]."
                variant="dont"
              />
              <RuleCard
                label="Text wraps intentionally"
                body="Headings use text-balance. Short body copy uses text-pretty. Do not fix orphans with manual line breaks."
                variant="do"
              />
              <RuleCard
                label="Stable Storybook assertions"
                body="Use role-scoped queries when text appears in headings, tooltips, and sr-only labels. Use getAllBy... only when duplicates are intentional."
                variant="do"
              />
              <RuleCard
                label="Token radii on controls"
                body="Dropdown rows, icon actions, and floating menus use radius-control or radius-floating. Do not reintroduce rounded-2xl or rounded-3xl."
                variant="do"
              />
            </div>
          </div>
        </Surface>

        {/* ── 15. What to avoid ─────────────────────────────────────────────── */}
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Anti-patterns"
              heading="Things that break the design language."
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <RuleCard
                label="Colored cards for categories"
                body="Do not apply category or type colors as card background fills. Colors appear in icons or text only — never as the dominant surface color."
                variant="dont"
              />
              <RuleCard
                label="Hard-coded border-radius"
                body="Never write rounded-2xl, rounded-3xl, or any arbitrary value like rounded-[22px]. Always use the four radius variables: tight / control / surface / floating."
                variant="dont"
              />
              <RuleCard
                label="Multiple prominent CTAs"
                body="Do not render two or more filled primary buttons on the same surface. Hierarchy collapses and the user stops reading."
                variant="dont"
              />
              <RuleCard
                label="Custom shadow values"
                body="Do not add new box-shadow values outside the Surface component. If a floating effect is needed, use tone='floating' or extend the Surface component itself."
                variant="dont"
              />
              <RuleCard
                label="Bright accent colors for data"
                body="Do not use Tailwind's indigo, blue, violet, etc. for positive/negative amounts or chart highlights. Use chart-1 through chart-5 or the destructive token."
                variant="dont"
              />
              <RuleCard
                label="Type outside the scale"
                body="Do not use arbitrary font sizes like text-[15px] or text-[11px]. The type scale ends at type-h1 (32px) and type-body-12 (12px). Everything fits within it."
                variant="dont"
              />
            </div>
          </div>
        </Surface>

      </div>
    </StoryWorkspace>
  ),
  parameters: {
    ...withPathname("/accounts"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reference: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("UI Playbook")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Canvas → Panel → Floating" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Rows are quiet. The group does the talking." })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Four kinds. One visual weight — except income." })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Small controls still need deliberate motion and real hit areas." })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Forms are sheets. Not dialogs, not center modals." })).toBeInTheDocument();
  },
};
