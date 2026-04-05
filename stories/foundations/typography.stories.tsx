import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Surface } from "@/components/surface";
import { StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

function TypeRow({
  label,
  className,
  sample,
}: {
  label: string;
  className: string;
  sample: string;
}) {
  return (
    <div className="grid gap-3 border-b border-black/6 py-4 md:grid-cols-[140px_minmax(0,1fr)] md:items-baseline">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={className}>{sample}</div>
    </div>
  );
}

const meta = {
  title: "Foundations/Typography",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="flex h-full flex-col gap-6 p-6">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Typography
            </p>
            <h1 className="type-h2">The system should feel editorial at the top and disciplined in routine UI.</h1>
            <p className="type-body-14 max-w-3xl text-muted-foreground">
              Serif belongs to rare anchors. Sans carries the application. The scale below is the default language for
              Moniq screens and floating tools.
            </p>
          </div>
        </Surface>

        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="space-y-1">
            <TypeRow label="H1" className="type-h1" sample="Balance should feel like a calm financial workspace." />
            <TypeRow label="H2" className="type-h2" sample="Plans and summaries need a clear editorial anchor." />
            <TypeRow label="H3" className="type-h3" sample="Major workspace sections keep generous hierarchy." />
            <TypeRow label="H4" className="type-h4" sample="Floating panels use compact but visible structure." />
            <TypeRow label="H5" className="type-h5" sample="UI headings should stay crisp and operational." />
            <TypeRow label="H6" className="type-h6" sample="Small labels need rhythm, not decoration." />
            <TypeRow
              label="Body 14"
              className="type-body-14"
              sample="Body copy explains context, but it should stay short and supportive."
            />
            <TypeRow
              label="Body 12"
              className="type-body-12"
              sample="Muted support text is for metadata, captions, and quiet UI explanation."
            />
          </div>
        </Surface>
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/accounts"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scale: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Typography")).toBeInTheDocument();
    await expect(canvas.getByText("Body 14")).toBeInTheDocument();
  },
};
