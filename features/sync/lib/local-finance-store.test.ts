import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import {
  hasValidOfflineAuthLease,
  OFFLINE_AUTH_MAX_AGE_MS,
  readCachedFinanceSnapshot,
  writeCachedFinanceSnapshot,
} from "@/features/sync/lib/local-finance-store";

function database(row: unknown = null) {
  return {
    execute: vi.fn(async () => undefined),
    getOptional: vi.fn(async () => row),
  } as unknown as AbstractPowerSyncDatabase;
}

describe("local finance storage", () => {
  it("accepts an offline authorization lease for exactly 30 days", async () => {
    const now = Date.parse("2026-06-28T10:00:00.000Z");
    const db = database({ verified_at: new Date(now - OFFLINE_AUTH_MAX_AGE_MS).toISOString() });

    await expect(hasValidOfflineAuthLease(db, "user-id", now)).resolves.toBe(true);
    await expect(hasValidOfflineAuthLease(db, "user-id", now + 1)).resolves.toBe(false);
  });

  it("rejects missing and malformed authorization leases", async () => {
    await expect(hasValidOfflineAuthLease(database(), "user-id")).resolves.toBe(false);
    await expect(hasValidOfflineAuthLease(database({ verified_at: "invalid" }), "user-id")).resolves.toBe(false);
  });

  it("round-trips the cached snapshot and ignores corrupt cache data", async () => {
    const snapshot = createEmptyFinanceSnapshot();
    const db = database({ payload: JSON.stringify(snapshot) });

    await expect(readCachedFinanceSnapshot(db, "user-id")).resolves.toEqual(snapshot);
    await writeCachedFinanceSnapshot(db, "user-id", snapshot);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("insert or replace into local_snapshots"),
      expect.arrayContaining(["current", "user-id", JSON.stringify(snapshot)]),
    );
    await expect(readCachedFinanceSnapshot(database({ payload: "{" }), "user-id")).resolves.toBeNull();
  });
});
