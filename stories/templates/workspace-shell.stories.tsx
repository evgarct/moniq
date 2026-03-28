import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";

const snapshot = makeFinanceSnapshot();

const meta = {
  title: "Templates/WorkspaceShell",
  render: () => (
    <StoryWorkspace pathname="/accounts">
      <div className="h-full p-6">
        <AccountsView
          accounts={snapshot.accounts}
          allocations={snapshot.allocations}
          transactions={snapshot.transactions}
        />
      </div>
    </StoryWorkspace>
  ),
  parameters: withPathname("/accounts"),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AccountsShell: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Organization Settings")).toBeInTheDocument();
  },
};
