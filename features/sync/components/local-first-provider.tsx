"use client";

import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getFinanceMutationCoordinator } from "@/features/finance/lib/coordinator-registry";
import { fetchFinanceSnapshot } from "@/features/finance/lib/finance-api";
import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
import {
  hasValidOfflineAuthLease,
  markOnlineAuthVerified,
  readCachedFinanceSnapshot,
  readSyncedFinanceSnapshot,
  writeCachedFinanceSnapshot,
} from "@/features/sync/lib/local-finance-store";
import { moniqPowerSyncSchema, POWER_SYNCED_TABLES } from "@/features/sync/lib/powersync-schema";
import { toSyncDetails, type SyncDetails } from "@/features/sync/lib/sync-progress";
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
  /**
   * Forces a re-read from the source of truth (Supabase): flushes queued commands,
   * fetches the server snapshot and reconnects PowerSync. Rejects if the server
   * cannot be reached so the caller can surface the error.
   */
  refresh: () => Promise<void>;
  refreshing: boolean;
  retryConflict: (id: string) => Promise<void>;
  status: SyncStatus;
  syncDetails: SyncDetails | null;
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
  refresh: async () => undefined,
  refreshing: false,
  retryConflict: async () => undefined,
  status: defaultStatus,
  syncDetails: null,
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
  const [syncDetails, setSyncDetails] = useState<SyncDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const connectorRef = useRef<PowerSyncBackendConnector | null>(null);
  const flushQueueRef = useRef<((options?: { strict?: boolean }) => Promise<void>) | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(enabled);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }
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
          setSyncDetails(toSyncDetails(localDatabase.currentStatus));
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

        /**
         * Pushes queued commands. `strict` (used before a forced refresh) drains every
         * batch and rethrows failures, so a refresh never rebases the cache onto a
         * server snapshot that is still missing queued edits.
         */
        async function flushQueue(options: { strict?: boolean } = {}) {
          const { strict = false } = options;
          if (!localDatabase) return;
          if (!navigator.onLine) {
            if (strict) throw new Error("Cannot flush queued changes while offline.");
            return;
          }
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
            const rejected = (body.results ?? []).filter(
              (result) => result.status !== "applied" && result.status !== "conflict",
            );
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
            // A rejected command leaves the outbox but never reaches the server. A refresh
            // must fail loudly instead of rebasing the cache onto a snapshot without it.
            if (strict && (!response.ok || rejected.length > 0)) {
              throw new Error("Some queued changes were rejected by the server.");
            }
          } catch (error) {
            setStatus((current) => ({ ...current, state: "reconnecting" }));
            if (strict) {
              await refreshQueueStatus();
              throw error;
            }
          }
          await refreshQueueStatus();

          if (strict) {
            const remaining = await localDatabase.getAll<{ id: string }>(
              "select id from local_sync_commands where user_id = ? and status = 'pending' limit 1",
              [userId],
            );
            if (remaining.length > 0) {
              // More than one batch was queued (or a batch made no progress): keep draining.
              // A batch that leaves the same rows pending would loop forever, so bail out.
              if (rows.every((row) => remaining.some((left) => left.id === row.id))) {
                throw new Error("Queued changes could not be synced.");
              }
              await flushQueue({ strict: true });
            }
          }
        }

        flushQueueRef.current = flushQueue;

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
            setSyncDetails(toSyncDetails(nextStatus));
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
          connectorRef.current = connector;
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
      connectorRef.current = null;
      flushQueueRef.current = null;
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

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      // 1. Push queued offline commands first so the server snapshot includes them.
      await flushQueueRef.current?.({ strict: true });
      // 2. Read the source of truth directly. The snapshot query prefers local SQLite
      //    when local-first is on, so invalidating it alone would never hit the server.
      const snapshot = await fetchFinanceSnapshot();
      getFinanceMutationCoordinator(queryClient).rebase(snapshot);
      // 3. Re-pull the local replica from the sync service (keeps the local outbox).
      const connector = connectorRef.current;
      if (database && connector && navigator.onLine) {
        await database.disconnect();
        await database.connect(connector);
        await database
          .waitForStatus(
            (current) => current.connected && !current.dataFlowStatus.downloading,
            AbortSignal.timeout(20_000),
          )
          .catch(() => undefined);
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [database, queryClient]);

  const value = useMemo(
    () => ({
      database,
      conflicts,
      discardConflict,
      enabled: syncEnabled,
      hydrated,
      refresh,
      refreshing,
      retryConflict,
      status,
      syncDetails,
      userId,
    }),
    [database, conflicts, discardConflict, syncEnabled, hydrated, refresh, refreshing, retryConflict, status, syncDetails, userId],
  );
  return <LocalFirstContext.Provider value={value}>{children}</LocalFirstContext.Provider>;
}

export function useLocalFirst() {
  return useContext(LocalFirstContext);
}
