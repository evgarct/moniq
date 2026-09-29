"use client";

import { RefreshCw } from "lucide-react";
import { useNow, useFormatter, useTranslations } from "next-intl";

import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import type { SyncProgressPhase } from "@/features/sync/lib/sync-progress";
import { cn } from "@/lib/utils";

export type SyncProgressProps = {
  phase: SyncProgressPhase;
  /** Transactions currently available on screen (already loaded). */
  transactionCount: number;
  /** 0..1 while PowerSync reports a download total, else null. */
  downloadFraction?: number | null;
  lastSyncedAt?: string | null;
  /** Queued local changes that have not reached the server yet. */
  pendingCount?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
};

/**
 * Quiet footer for lists: what is already loaded, whether the server is still
 * sending data, and a button to force a re-read from the source of truth.
 * Flat text + hairline progress track — no card, chip or badge.
 */
export function SyncProgress({
  phase,
  transactionCount,
  downloadFraction = null,
  lastSyncedAt = null,
  pendingCount = 0,
  refreshing = false,
  onRefresh,
  className,
}: SyncProgressProps) {
  const t = useTranslations("sync.loader");
  const formatter = useFormatter();
  const now = useNow({ updateInterval: 30_000 });

  const busy = phase === "loading" || phase === "syncing" || refreshing;
  const showProgress = (phase === "loading" || phase === "syncing") && downloadFraction !== null;

  const headline = (() => {
    switch (phase) {
      case "loading":
        return t("loadingCount", { count: transactionCount });
      case "syncing":
        return t("syncingCount", { count: transactionCount });
      case "offline":
        return t("offlineCount", { count: transactionCount });
      case "error":
        return t("error");
      default:
        return t("upToDate", { count: transactionCount });
    }
  })();

  const detail = showProgress
    ? t("progress", { percent: String(Math.round((downloadFraction ?? 0) * 100)) })
    : pendingCount > 0 && phase !== "loading" && phase !== "error"
      ? t("pendingChanges", { count: pendingCount })
      : phase === "idle" || phase === "offline"
        ? lastSyncedAt
          ? t("syncedAt", { time: formatter.relativeTime(new Date(lastSyncedAt), Math.max(now.getTime(), Date.parse(lastSyncedAt))) })
          : t("neverSynced")
        : null;

  return (
    <div className={cn("flex flex-col gap-2 px-2 py-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0" role="status" aria-live="polite">
          <p className="type-body-12 text-foreground">{headline}</p>
          {detail ? <p className="type-body-12 text-muted-foreground">{detail}</p> : null}
        </div>
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            disabled={busy}
            aria-busy={busy}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" className={cn(busy && "motion-safe:animate-spin")} />
            {refreshing ? t("refreshing") : t("refresh")}
          </Button>
        ) : null}
      </div>
      {showProgress ? (
        <ProgressTrack value={downloadFraction ?? 0} trackClassName="bg-border/50" fillClassName="bg-foreground/70" />
      ) : null}
    </div>
  );
}
