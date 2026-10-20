import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FinanceLoadError } from "@/features/finance/components/finance-load-error";

const meta = {
  title: "Molecules/FinanceLoadError",
  component: FinanceLoadError,
  args: {
    title: "Unable to load today",
    fallbackDescription: "Finance data could not be loaded.",
    error: new Error("Can't reach the server. Check your connection and try again."),
    onRetry: fn(),
  },
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FinanceLoadError>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NetworkUnavailable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const UnknownError: Story = {
  args: {
    error: null,
  },
};
