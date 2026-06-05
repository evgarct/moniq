import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { McpSettings } from "@/features/settings/components/mcp-settings";
import { CurrencySettings } from "@/features/settings/components/currency-settings";
import { PageContainer } from "@/components/page-container";
import { AppProviders } from "@/components/providers/app-providers";
import { makeFinanceSnapshot, StoryWorkspace, withPathname } from "@/stories/fixtures/story-data";
import type { CurrencyCode } from "@/types/currency";

makeFinanceSnapshot(); // ensure fixtures load

const sampleKeys = [
  {
    id: "key-1",
    name: "My laptop",
    key_prefix: "mnq_a1b2c3",
    last_used_at: "2026-04-10T14:00:00Z",
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "key-2",
    name: "Home desktop",
    key_prefix: "mnq_d4e5f6",
    last_used_at: null,
    created_at: "2026-04-01T09:00:00Z",
  },
];

function SettingsPageTemplate({ keys }: { keys: typeof sampleKeys }) {
  const snapshot = makeFinanceSnapshot();
  const walletCurrencies = Array.from(new Set(snapshot.accounts.map((account) => account.currency))) as CurrencyCode[];

  return (
    <AppProviders>
      <StoryWorkspace pathname="/settings">
        <PageContainer className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          </div>
          <div className="flex flex-col gap-8">
            <CurrencySettings
              initialDefaultCurrency={snapshot.preferences.default_currency}
              initialDefaultCurrencySource={snapshot.preferences.default_currency_source}
              walletCurrencies={walletCurrencies}
            />
            <McpSettings initialKeys={keys} />
          </div>
        </PageContainer>
      </StoryWorkspace>
    </AppProviders>
  );
}

const meta = {
  title: "Pages/Settings",
  parameters: {
    ...withPathname("/settings"),
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SettingsPageTemplate keys={sampleKeys} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Settings")).toBeInTheDocument();
    await expect(canvas.getByText("Default currency")).toBeInTheDocument();
    await expect(canvas.getByText("Claude MCP Connector")).toBeInTheDocument();
    await expect(canvas.getByText("My laptop")).toBeInTheDocument();
  },
};

export const NoKeys: Story = {
  render: () => <SettingsPageTemplate keys={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Settings")).toBeInTheDocument();
    await expect(canvas.getByText("No connected keys yet.")).toBeInTheDocument();
  },
};
