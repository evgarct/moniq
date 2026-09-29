import { describe, expect, it } from "vitest";

import {
  emptySyncDetails,
  resolveSyncProgressPhase,
  toSyncDetails,
  type SyncDetails,
} from "./sync-progress";

const base = {
  localFirstEnabled: true,
  dataLoading: false,
  refreshing: false,
  status: { state: "cached" as const },
  details: { ...emptySyncDetails, hasSynced: true, connected: true } satisfies SyncDetails,
};

describe("toSyncDetails", () => {
  it("maps PowerSync status fields", () => {
    const details = toSyncDetails({
      connected: true,
      connecting: false,
      hasSynced: true,
      lastSyncedAt: new Date("2026-09-29T10:00:00.000Z"),
      dataFlowStatus: { downloading: true, uploading: false },
      downloadProgress: { downloadedFraction: 0.4 },
    });

    expect(details).toEqual({
      connected: true,
      connecting: false,
      hasSynced: true,
      downloading: true,
      uploading: false,
      downloadFraction: 0.4,
      lastSyncedAt: "2026-09-29T10:00:00.000Z",
    });
  });

  it("uses null for unknown values", () => {
    const details = toSyncDetails({
      connected: false,
      connecting: true,
      dataFlowStatus: {},
      downloadProgress: null,
    });

    expect(details.hasSynced).toBeNull();
    expect(details.downloadFraction).toBeNull();
    expect(details.lastSyncedAt).toBeNull();
  });
});

describe("resolveSyncProgressPhase", () => {
  it("is idle when up to date", () => {
    expect(resolveSyncProgressPhase(base)).toBe("idle");
  });

  it("is loading while data is not on screen yet", () => {
    expect(resolveSyncProgressPhase({ ...base, dataLoading: true })).toBe("loading");
  });

  it("is loading during the very first download", () => {
    expect(
      resolveSyncProgressPhase({ ...base, details: { ...base.details, hasSynced: false, downloading: true } }),
    ).toBe("loading");
  });

  it("is syncing when refreshing already-loaded data", () => {
    expect(resolveSyncProgressPhase({ ...base, refreshing: true })).toBe("syncing");
    expect(resolveSyncProgressPhase({ ...base, details: { ...base.details, uploading: true } })).toBe("syncing");
  });

  it("reports offline and storage errors before anything else", () => {
    expect(resolveSyncProgressPhase({ ...base, dataLoading: true, status: { state: "offline" } })).toBe("offline");
    expect(resolveSyncProgressPhase({ ...base, status: { state: "storage_error" } })).toBe("error");
  });

  it("never renders queued changes as up to date", () => {
    expect(
      resolveSyncProgressPhase({
        ...base,
        status: { state: "pending" },
        details: { ...base.details, connected: false },
      }),
    ).toBe("offline");
    expect(resolveSyncProgressPhase({ ...base, status: { state: "pending" } })).toBe("syncing");
  });

  it("is idle without local-first once data is loaded", () => {
    expect(resolveSyncProgressPhase({ ...base, localFirstEnabled: false, details: null })).toBe("idle");
  });
});
