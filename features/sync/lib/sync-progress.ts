import type { SyncStatus } from "@/types/sync";

/** The subset of PowerSync's `SyncStatus` the UI cares about. */
export type PowerSyncStatusLike = {
  connected: boolean;
  connecting: boolean;
  hasSynced?: boolean;
  lastSyncedAt?: Date;
  dataFlowStatus: { downloading?: boolean; uploading?: boolean };
  downloadProgress: { downloadedFraction: number } | null;
};

export type SyncDetails = {
  connected: boolean;
  connecting: boolean;
  /** `null` while PowerSync has not reported yet. */
  hasSynced: boolean | null;
  downloading: boolean;
  uploading: boolean;
  /** 0..1 while a download is in flight and PowerSync knows the total, else null. */
  downloadFraction: number | null;
  lastSyncedAt: string | null;
};

export const emptySyncDetails: SyncDetails = {
  connected: false,
  connecting: false,
  hasSynced: null,
  downloading: false,
  uploading: false,
  downloadFraction: null,
  lastSyncedAt: null,
};

export function toSyncDetails(status: PowerSyncStatusLike): SyncDetails {
  return {
    connected: status.connected,
    connecting: status.connecting,
    hasSynced: status.hasSynced ?? null,
    downloading: Boolean(status.dataFlowStatus.downloading),
    uploading: Boolean(status.dataFlowStatus.uploading),
    downloadFraction: status.downloadProgress ? status.downloadProgress.downloadedFraction : null,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
  };
}

export type SyncProgressPhase = "loading" | "syncing" | "offline" | "error" | "idle";

/**
 * Collapses provider state into one phase the footer can render:
 * - loading: nothing usable on screen yet, or the very first sync is still running
 * - syncing: data is on screen and is being refreshed/uploaded
 * - offline / error: cannot reach the server / local storage failed
 * - idle: up to date
 */
export function resolveSyncProgressPhase(input: {
  localFirstEnabled: boolean;
  dataLoading: boolean;
  refreshing: boolean;
  status: Pick<SyncStatus, "state">;
  details: SyncDetails | null;
}): SyncProgressPhase {
  const { localFirstEnabled, dataLoading, refreshing, status, details } = input;

  if (status.state === "storage_error") return "error";
  if (status.state === "offline" || status.state === "expired") return "offline";
  if (dataLoading) return "loading";
  if (refreshing) return "syncing";
  if (!localFirstEnabled || !details) return "idle";
  if (details.hasSynced !== true && (details.downloading || details.connecting)) return "loading";
  if (details.downloading || details.uploading || status.state === "syncing" || status.state === "reconnecting") {
    return "syncing";
  }
  return "idle";
}
