import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { SyncProgress } from "@/components/sync-progress";
import { StoryDemoFrame } from "@/stories/fixtures/story-data";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const meta = {
  title: "Molecules/SyncProgress",
  component: SyncProgress,
  args: {
    phase: "idle",
    transactionCount: 128,
    lastSyncedAt: minutesAgo(2),
    onRefresh: fn(),
  },
  decorators: [
    (Story) => (
      <StoryDemoFrame>
        <div className="max-w-md bg-background">
          <Story />
        </div>
      </StoryDemoFrame>
    ),
  ],
} satisfies Meta<typeof SyncProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UpToDate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/up to date/i)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /refresh from server/i }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};

export const FirstLoadWithProgress: Story = {
  args: {
    phase: "loading",
    transactionCount: 42,
    downloadFraction: 0.45,
    lastSyncedAt: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/45% downloaded/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /refresh from server/i })).toBeDisabled();
  },
};

export const FirstLoadNothingYet: Story = {
  args: {
    phase: "loading",
    transactionCount: 0,
    downloadFraction: null,
    lastSyncedAt: null,
  },
};

export const SyncingChanges: Story = {
  args: {
    phase: "syncing",
    transactionCount: 128,
    downloadFraction: 0.8,
  },
};

export const RefreshingFromServer: Story = {
  args: {
    phase: "syncing",
    transactionCount: 128,
    refreshing: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /refreshing/i })).toBeDisabled();
  },
};

export const Offline: Story = {
  args: {
    phase: "offline",
    transactionCount: 128,
    lastSyncedAt: minutesAgo(90),
  },
};

export const OfflineWithPendingChanges: Story = {
  args: {
    phase: "offline",
    transactionCount: 128,
    lastSyncedAt: minutesAgo(90),
    pendingCount: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/3 changes waiting to sync/i)).toBeInTheDocument();
  },
};

export const StorageError: Story = {
  args: {
    phase: "error",
    transactionCount: 0,
    lastSyncedAt: null,
  },
};
