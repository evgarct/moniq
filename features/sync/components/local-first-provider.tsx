"use client";

import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
import {
  hasValidOfflineAuthLease,
  markOnlineAuthVerified,
  readCachedFinanceSnapshot,
  readSyncedFinanceSnapshot,
  writeCachedFinanceSnapshot,
} from "@/features/sync/lib/local-finance-store";
import { moniqPowerSyncSchema, POWER_SYNCED_TABLES } from "@/features/sync/lib/powersync-schema";
import { reportClientPerformanceEvent } from "@/lib/performance/client";
import { createClient } from "@/lib/supabase/client";
import type { FinanceSnapshot } from "@/types/finance";
import type { SyncBootstrap, SyncCommand, SyncStatus } from "@/types/sync";

export type LocalSyncConflict = {
  id: string;
  commandType: SyncCommand["type"];
  serverVersion: number;
};

type LocalFirstContextValue = {
  database: AbstractPowerSyncDatabase | null;
  conflicts: LocalSyncConflict[];
  discardConflict: (id: string) => Promise<void>;
  enabled: boolean;
  hydrated: boolean;
  retryConflict: (id: string) => Promise<void>;
  status: SyncStatus;
  userId?: string | null;
};

const defaultStatus: SyncStatus = {
  state: "cached",
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
};

const LocalFirstContext = createContext<LocalFirstContextValue>({
  database: null,
  conflicts: [],
  discardConflict: async () => undefined,
  enabled: false,
  hydrated: true,
  retryConflict: async () => undefined,
  status: defaultStatus,
});

let activeDatabase: AbstractPowerSyncDatabase | null = null;
let activeUserId: string | null = null;

export type SyncCommandDraft = Pick<SyncCommand, "type" | "targetId" | "baseVersion" | "payload">;

export async function queueLocalFirstCommand(draft: SyncCommandDraft) {
  if (!activeDatabase || !activeUserId) return false;
  const now = new Date().toISOString();
  const command: SyncCommand = {
    ...draft,
    id: crypto.randomUUID(),
    deviceId: await activeDatabase.getClientId(),
    createdAt: now,
  } as SyncCommand;
  await activeDatabase.execute(
    `insert into local_sync_commands(id, user_id, payload, status, created_at, updated_at, result) values (?, ?, ?, ?, ?, ?, ?)`,
    [command.id, activeUserId, JSON.stringify(command), "pending", now, now, null],
  );
  return true;
}

export async function clearLocalFirstData() {
  if (!activeDatabase) return;
  await activeDatabase.disconnectAndClear();
  activeDatabase = null;
  activeUserId = null;
}

function isLocalFirstEnabled() {
  return process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE === "on" || process.env.NEXT_PUBLIC_LOCAL_FIRST_MODE === "pilot";
}

function statusFromDatabase(database: AbstractPowerSyncDatabase): SyncStatus {
  const current = database.currentStatus;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const state = offline
    ? "offline"
    : current.dataFlowStatus.uploading || current.dataFlowStatus.downloading
      ? "syncing"
      : current.connecting
        ? "reconnecting"
        : "cached";
  return {
    state,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncedAt: current.lastSyncedAt?.toISOString() ?? null,
  };
}

export function LocalFirstProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const enabled = isLocalFirstEnabled();
  const [database, setDatabase] = useState<AbstractPowerSyncDatabase | null>(null);
  const [conflicts, setConflicts] = useState<LocalSyncConflict[]>([]);
  const [hydrated, setHydrated] = useState(!enabled);
  const [status, setStatus] = useState<SyncStatus>(defaultStatus);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(enabled);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUserId(session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUserId(session?.user.id ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!authUserId) {
      setDatabase(null);
      setUserId(null);
      setHydrated(true);
      queryClient.removeQueries({ queryKey: financeSnapshotQueryKey });
      return;
    }
    let cancelled = false;
    let disposeChanges: (() => void) | undefined;
    let disposeStatus: (() => void) | undefined;
    let unsubscribeQuery: (() => void) | undefined;
    let localDatabase: AbstractPowerSyncDatabase | null = null;

    async function initialize() {
      const startedAt = performance.now();
      try {
        const supabase = createClient();
        const userId = authUserId!;
        if (!cancelled) setUserId(userId);

        const { PowerSyncDatabase } = await import("@powersync/web");
        localDatabase = new PowerSyncDatabase({
          schema: moniqPowerSyncSchema,
          database: { dbFilename: `moniq-${userId}.sqlite` },
        });
        await localDatabase.init();
        if (cancelled) {
          await localDatabase.close();
          return;
        }
        activeDatabase = localDatabase;
        activeUserId = userId;
        setDatabase(localDatabase);

        const synced = await readSyncedFinanceSnapshot(localDatabase);
        const cached = await readCachedFinanceSnapshot(localDatabase, userId);
        const initialSnapshot = synced ?? cached;
        if (initialSnapshot) {
          queryClient.setQueryData(financeSnapshotQueryKey, initialSnapshot);
        }

        if (!cancelled) {
          setHydrated(true);
          reportClientPerformanceEvent({
            event_type: "navigation",
            name: "first_local_data",
            duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
            metadata: { cache_hit: Boolean(initialSnapshot) },
          });
        }

        unsubscribeQuery = queryClient.getQueryCache().subscribe((event) => {
          if (event.query.queryKey[0] !== financeSnapshotQueryKey[0]) return;
          const snapshot = event.query.state.data as FinanceSnapshot | undefined;
          if (!snapshot || !localDatabase) return;
          if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
          persistTimer.current = window.setTimeout(() => {
            void writeCachedFinanceSnapshot(localDatabase!, userId, snapshot);
          }, 100);
        });

        disposeChanges = localDatabase.onChange(
          {
            onChange: async () => {
              if (!localDatabase) return;
              const snapshot = await readSyncedFinanceSnapshot(localDatabase);
              if (snapshot) queryClient.setQueryData(financeSnapshotQueryKey, snapshot);
            },
          },
          { tables: [...POWER_SYNCED_TABLES], throttleMs: 100 },
        );

        const bootstrapResponse = await fetch("/api/sync/bootstrap", { credentials: "include", cache: "no-store" });
        if (!bootstrapResponse.ok) throw new Error(`Sync bootstrap failed with ${bootstrapResponse.status}.`);
        const bootstrap = await bootstrapResponse.json() as SyncBootstrap;
        if (!bootstrap.enabled) {
          if (!cancelled) {
            setSyncEnabled(false);
            setDatabase(null);
            activeDatabase = null;
            activeUserId = null;
          }
          await localDatabase.disconnectAndClear();
          return;
        }

        const online = navigator.onLine;
        if (online) {
          await markOnlineAuthVerified(localDatabase, userId);
          void fetch("/api/finance/schedules/reconcile", {
            method: "POST",
            credentials: "include",
          });
        } else if (!(await hasValidOfflineAuthLease(localDatabase, userId))) {
          if (!cancelled) {
            setStatus({ ...defaultStatus, state: "expired" });
          }
          return;
        }

        if (!cancelled) {
          setStatus({ ...statusFromDatabase(localDatabase), state: online ? "cached" : "offline" });
        }

        async function refreshQueueStatus() {
          if (!localDatabase) return;
          const rows = await localDatabase.getAll<{ id: string; payload: string; result: string | null; status: string }>("select id, payload, result, status from local_sync_commands where user_id = ?", [userId]);
          const pendingCount = rows.filter((row) => row.status === "pending").length;
          const conflictRows = rows.filter((row) => row.status === "conflict");
          const conflictCount = conflictRows.length;
          setConflicts(conflictRows.map((row) => {
            const command = JSON.parse(row.payload) as SyncCommand;
            const result = row.result ? JSON.parse(row.result) as { serverVersion?: number } : null;
            return { id: row.id, commandType: command.type, serverVersion: result?.serverVersion ?? 1 };
          }));
          setStatus((current) => ({
            ...current,
            state: conflictCount > 0 ? "conflict" : pendingCount > 0 && !navigator.onLine ? "pending" : current.state,
            pendingCount,
            conflictCount,
          }));
        }

        async function flushQueue() {
          if (!localDatabase || !navigator.onLine) return;
          const rows = await localDatabase.getAll<{ id: string; payload: string }>(
            "select id, payload from local_sync_commands where user_id = ? and status = 'pending' order by created_at limit 25",
            [userId],
          );
          if (!rows.length) {
            await refreshQueueStatus();
            return;
          }
          setStatus((current) => ({ ...current, state: "syncing", pendingCount: rows.length }));
          try {
            const response = await fetch("/api/sync/commands", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ commands: rows.map((row) => JSON.parse(row.payload)) }),
            });
            const body = await response.json() as { results?: Array<{ id: string; status: string; [key: string]: unknown }> };
            for (const result of body.results ?? []) {
              if (result.status === "applied") {
                await localDatabase.execute("delete from local_sync_commands where id = ?", [result.id]);
              } else {
                await localDatabase.execute(
                  "update local_sync_commands set status = ?, result = ?, updated_at = ? where id = ?",
                  [result.status, JSON.stringify(result), new Date().toISOString(), result.id],
                );
              }
            }
            await queryClient.invalidateQueries({ queryKey: financeSnapshotQueryKey });
          } catch {
            setStatus((current) => ({ ...current, state: "reconnecting" }));
          }
          await refreshQueueStatus();
        }

        const disposeOutbox = localDatabase.onChange(
          { onChange: () => { void refreshQueueStatus(); if (navigator.onLine) void flushQueue(); } },
          { tables: ["local_sync_commands"], throttleMs: 50 },
        );
        const handleOnline = () => { void flushQueue(); };
        const handleOffline = () => setStatus((current) => ({ ...current, state: current.pendingCount ? "pending" : "offline" }));
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        void refreshQueueStatus();
        void flushQueue();

        disposeStatus = localDatabase.registerListener({
          statusChanged(nextStatus) {
            if (!localDatabase) return;
            setStatus((current) => ({
              ...statusFromDatabase(localDatabase!),
              state: current.conflictCount > 0 ? "conflict" : current.pendingCount > 0 ? "pending" : statusFromDatabase(localDatabase!).state,
              pendingCount: current.pendingCount,
              conflictCount: current.conflictCount,
              lastSyncedAt: nextStatus.lastSyncedAt?.toISOString() ?? null,
            }));
          },
        });

        const endpoint = bootstrap.powersyncUrl;
        if (endpoint && online) {
          const connector: PowerSyncBackendConnector = {
            async fetchCredentials() {
              const { data: { session: freshSession }, error } = await supabase.auth.getSession();
              if (error) throw error;
              if (!freshSession) return null;
              return { endpoint, token: freshSession.access_token };
            },
            async uploadData(db) {
              const batch = await db.getCrudBatch();
              if (!batch) return;
              const response = await fetch("/api/sync/powersync", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operations: batch.crud }),
              });
              if (!response.ok) throw new Error(`PowerSync upload failed with ${response.status}.`);
              await batch.complete();
            },
          };
          await localDatabase.connect(connector);
        }

        const previousDispose = disposeChanges;
        disposeChanges = () => {
          previousDispose?.();
          disposeOutbox();
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        };
      } catch (error) {
        console.error("Unable to initialize local-first storage", error);
        if (!cancelled) {
          setStatus({ ...defaultStatus, state: "storage_error" });
          setHydrated(true);
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      disposeChanges?.();
      disposeStatus?.();
      unsubscribeQuery?.();
      if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
      if (activeDatabase === localDatabase) activeDatabase = null;
      if (activeDatabase === null) activeUserId = null;
      if (localDatabase) void localDatabase.close();
    };
  }, [enabled, queryClient, authUserId]);

  const discardConflict = useCallback(async (id: string) => {
    if (!database) return;
    await database.execute("delete from local_sync_commands where id = ? and status = 'conflict'", [id]);
    setConflicts((current) => current.filter((item) => item.id !== id));
    await queryClient.invalidateQueries({ queryKey: financeSnapshotQueryKey });
  }, [database, queryClient]);

  const retryConflict = useCallback(async (id: string) => {
    if (!database || !activeUserId) return;
    const row = await database.getOptional<{ payload: string; result: string | null }>(
      "select payload, result from local_sync_commands where id = ? and status = 'conflict'",
      [id],
    );
    if (!row) return;
    const command = JSON.parse(row.payload) as SyncCommand;
    const result = row.result ? JSON.parse(row.result) as { serverVersion?: number } : null;
    const now = new Date().toISOString();
    const retried = { ...command, id: crypto.randomUUID(), baseVersion: result?.serverVersion ?? command.baseVersion, createdAt: now };
    await database.writeTransaction(async (tx) => {
      await tx.execute("delete from local_sync_commands where id = ?", [id]);
      await tx.execute(
        "insert into local_sync_commands(id, user_id, payload, status, created_at, updated_at, result) values (?, ?, ?, 'pending', ?, ?, null)",
        [retried.id, activeUserId, JSON.stringify(retried), now, now],
      );
    });
  }, [database]);

  const value = useMemo(
    () => ({ database, conflicts, discardConflict, enabled: syncEnabled, hydrated, retryConflict, status, userId }),
    [database, conflicts, discardConflict, syncEnabled, hydrated, retryConflict, status, userId],
  );
  return <LocalFirstContext.Provider value={value}>{children}</LocalFirstContext.Provider>;
}

export function useLocalFirst() {
  return useContext(LocalFirstContext);
}
