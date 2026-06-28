"use client";

import { Cloud, CloudOff, Database, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLocalFirst } from "@/features/sync/components/local-first-provider";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/types/sync";

export type SyncConflictItem = {
  id: string;
  commandType: string;
  serverVersion: number;
};

type SyncStatusIndicatorProps = {
  className?: string;
  conflicts?: SyncConflictItem[];
  forceVisible?: boolean;
  onDiscardConflict?: (id: string) => void;
  onRetryConflict?: (id: string) => void;
  status?: SyncStatus;
};

const iconByState = {
  cached: Database,
  syncing: RefreshCw,
  offline: CloudOff,
  pending: CloudOff,
  reconnecting: RefreshCw,
  conflict: TriangleAlert,
  storage_error: TriangleAlert,
  expired: CloudOff,
} as const;

export function SyncStatusIndicator({
  className,
  conflicts: conflictsProp,
  forceVisible = false,
  onDiscardConflict,
  onRetryConflict,
  status: statusProp,
}: SyncStatusIndicatorProps) {
  const t = useTranslations("sync");
  const localFirst = useLocalFirst();
  const conflicts = conflictsProp ?? localFirst.conflicts;
  const discardConflict = onDiscardConflict ?? localFirst.discardConflict;
  const retryConflict = onRetryConflict ?? localFirst.retryConflict;
  const status = statusProp ?? localFirst.status;
  const Icon = iconByState[status.state] ?? Cloud;
  const visible = forceVisible || status.state !== "cached" || status.pendingCount > 0;

  if (!visible) return null;

  const content = (
    <span className="flex min-h-10 items-center justify-center gap-2 px-4 type-body-12 text-muted-foreground">
      <Icon aria-hidden="true" className={cn(status.state === "syncing" || status.state === "reconnecting" ? "motion-safe:animate-spin" : undefined)} />
      <span>{t(`states.${status.state}`, { count: status.pendingCount })}</span>
    </span>
  );

  if (status.state !== "conflict") {
    return <div className={cn("border-b border-border/70 bg-card", className)}>{content}</div>;
  }

  return (
    <div className={cn("border-b border-border/70 bg-card", className)}>
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" className="h-auto w-full rounded-none p-0" />}>
          {content}
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{t("conflicts.title")}</SheetTitle>
            <SheetDescription>{t("conflicts.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col divide-y divide-border/70 px-4">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="type-body-14 font-medium text-foreground">{t("conflicts.item")}</p>
                  <p className="type-body-12 text-muted-foreground">{t("conflicts.version", { version: String(conflict.serverVersion) })}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void discardConflict(conflict.id)}>
                    {t("conflicts.keepServer")}
                  </Button>
                  <Button onClick={() => void retryConflict(conflict.id)}>
                    {t("conflicts.retryLocal")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <SheetFooter />
        </SheetContent>
      </Sheet>
    </div>
  );
}
