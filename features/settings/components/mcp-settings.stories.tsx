import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { McpSettings } from "./mcp-settings";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";

const meta = {
  title: "Features/Settings/McpSettings",
  decorators: [
    (Story) => (
      <StoryDemoFrame width="max-w-2xl">
        <Story />
      </StoryDemoFrame>
    ),
  ],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

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

export const NoKeys: Story = {
  render: () => <McpSettings initialKeys={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Claude MCP Connector")).toBeInTheDocument();
    await expect(canvas.getByText("No API keys yet.")).toBeInTheDocument();
  },
};

export const WithKeys: Story = {
  render: () => <McpSettings initialKeys={sampleKeys} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("My laptop")).toBeInTheDocument();
    await expect(canvas.getByText("Home desktop")).toBeInTheDocument();
  },
};

export const SingleKey: Story = {
  render: () => <McpSettings initialKeys={[sampleKeys[0]]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("My laptop")).toBeInTheDocument();
  },
};
