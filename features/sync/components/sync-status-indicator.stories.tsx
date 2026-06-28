import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { SyncStatusIndicator } from "@/features/sync/components/sync-status-indicator";
import type { SyncState, SyncStatus } from "@/types/sync";

const states: SyncState[] = [
  "cached",
  "syncing",
  "offline",
  "pending",
  "reconnecting",
  "storage_error",
  "expired",
];

const meta = {
  title: "Molecules/SyncStatusIndicator",
  component: SyncStatusIndicator,
  parameters: { layout: "fullscreen" },
  args: {
    forceVisible: true,
    status: { state: "offline", pendingCount: 0, conflictCount: 0, lastSyncedAt: null },
  },
} satisfies Meta<typeof SyncStatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col bg-background">
      {states.map((state) => (
        <SyncStatusIndicator
          key={state}
          forceVisible
          status={{
            state,
            pendingCount: state === "pending" ? 3 : 0,
            conflictCount: 0,
            lastSyncedAt: state === "cached" ? "2026-06-28T08:00:00.000Z" : null,
          } satisfies SyncStatus}
        />
      ))}
    </div>
  ),
};

export const Conflict: Story = {
  args: {
    status: { state: "conflict", pendingCount: 1, conflictCount: 1, lastSyncedAt: null },
    conflicts: [
      {
        id: "transaction-conflict",
        commandType: "transaction.update",
        serverVersion: 4,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await waitFor(async () => {
      await expect(within(document.body).getByRole("heading", { name: /review sync conflicts/i })).toBeVisible();
    });
  },
};
