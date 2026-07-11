import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ThemeSettings } from "./theme-settings";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";
import { AppProviders } from "@/components/providers/app-providers";

const meta = {
  title: "Features/Settings/ThemeSettings",
  decorators: [
    (Story) => (
      <AppProviders>
        <StoryDemoFrame width="max-w-2xl">
          <Story />
        </StoryDemoFrame>
      </AppProviders>
    ),
  ],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ThemeSettings />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Appearance")).toBeInTheDocument();
    await expect(canvas.getByText("Theme")).toBeInTheDocument();
  },
};
