"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { SyncProgress } from "@/components/sync-progress";
import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
import { useLocalFirst } from "@/features/sync/components/local-first-provider";
import { resolveSyncProgressPhase } from "@/features/sync/lib/sync-progress";

/** `SyncProgress` wired to the local-first provider. */
export function SyncProgressFooter({
  transactionCount,
  dataLoading = false,
  className,
}: {
  transactionCount: number;
  dataLoading?: boolean;
  className?: string;
}) {
  const t = useTranslations("sync.loader");
  const localFirst = useLocalFirst();
  const queryClient = useQueryClient();

  const phase = resolveSyncProgressPhase({
    localFirstEnabled: localFirst.enabled,
    dataLoading,
    refreshing: localFirst.refreshing,
    status: localFirst.status,
    details: localFirst.syncDetails,
  });

  // Prefer the local replica's own last-sync time. When it has none (local-first off, or
  // the replica has not synced yet) the snapshot was fetched from the server, so the
  // query's last update is the best available sync time.
  const queryUpdatedAt = queryClient.getQueryState(financeSnapshotQueryKey)?.dataUpdatedAt ?? 0;
  const lastSyncedAt =
    localFirst.status.lastSyncedAt ??
    localFirst.syncDetails?.lastSyncedAt ??
    (queryUpdatedAt > 0 ? new Date(queryUpdatedAt).toISOString() : null);

  async function handleRefresh() {
    try {
      await localFirst.refresh();
      toast.success(t("refreshDone"));
    } catch {
      toast.error(t("refreshError"));
    }
  }

  return (
    <SyncProgress
      className={className}
      phase={phase}
      transactionCount={transactionCount}
      downloadFraction={localFirst.syncDetails?.downloadFraction ?? null}
      lastSyncedAt={lastSyncedAt}
      pendingCount={localFirst.status.pendingCount}
      refreshing={localFirst.refreshing}
      onRefresh={() => void handleRefresh()}
    />
  );
}
