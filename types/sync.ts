export const syncStateValues = [
  "cached",
  "syncing",
  "offline",
  "pending",
  "reconnecting",
  "conflict",
  "storage_error",
  "expired",
] as const;

export type SyncState = (typeof syncStateValues)[number];

export type SyncStatus = {
  state: SyncState;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
};

type SyncCommandBase<TType extends string, TPayload> = {
  id: string;
  deviceId: string;
  type: TType;
  targetId: string | null;
  baseVersion: number | null;
  createdAt: string;
  payload: TPayload;
};

export type SyncCommand =
  | SyncCommandBase<"wallet.create" | "wallet.update", Record<string, unknown>>
  | SyncCommandBase<"wallet.adjust", { newBalance: number; note: string | null }>
  | SyncCommandBase<"wallet.delete", Record<string, never>>
  | SyncCommandBase<"category.create" | "category.update", Record<string, unknown>>
  | SyncCommandBase<"category.delete", { replacementCategoryId: string | null }>
  | SyncCommandBase<"transaction.create" | "transaction.update", Record<string, unknown>>
  | SyncCommandBase<"transaction.delete" | "transaction.markPaid" | "transaction.skip", Record<string, never>>
  | SyncCommandBase<"schedule.update", Record<string, unknown>>
  | SyncCommandBase<"schedule.state", { state: "active" | "paused" }>
  | SyncCommandBase<"schedule.reschedule", { fromOccurrenceDate: string; newOccurrenceDate: string }>
  | SyncCommandBase<"schedule.delete", Record<string, never>>
  | SyncCommandBase<"allocation.create" | "allocation.update", Record<string, unknown>>
  | SyncCommandBase<"allocation.delete", Record<string, never>>
  | SyncCommandBase<"preferences.update", { default_currency: string }>;

export type SyncCommandResult =
  | { id: string; status: "applied"; serverVersion: number | null }
  | { id: string; status: "conflict"; serverVersion: number; serverRecord: Record<string, unknown> | null }
  | { id: string; status: "rejected"; errorCode: string };

export type SyncBootstrap = {
  enabled: boolean;
  mode: "off" | "pilot" | "on";
  powersyncUrl: string | null;
  serverTime: string;
  userId: string;
};
