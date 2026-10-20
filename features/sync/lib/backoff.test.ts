import { describe, expect, it, vi } from "vitest";

import { backoffDelay, isNetworkFetchError, retryWithBackoff } from "./backoff";

describe("backoffDelay", () => {
  it("doubles per attempt and caps at the maximum", () => {
    const noJitter = () => 0;
    expect(backoffDelay(0, { baseMs: 1_000, maxMs: 8_000 }, noJitter)).toBe(1_000);
    expect(backoffDelay(2, { baseMs: 1_000, maxMs: 8_000 }, noJitter)).toBe(4_000);
    expect(backoffDelay(10, { baseMs: 1_000, maxMs: 8_000 }, noJitter)).toBe(8_000);
  });

  it("adds at most 20% jitter", () => {
    expect(backoffDelay(0, { baseMs: 1_000 }, () => 1)).toBe(1_200);
  });
});

describe("retryWithBackoff", () => {
  it("returns the first successful result and sleeps between failures", async () => {
    const sleep = vi.fn(async () => undefined);
    const task = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    await expect(retryWithBackoff(task, { attempts: 3, sleep })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("rethrows the last error after exhausting attempts", async () => {
    const sleep = vi.fn(async () => undefined);
    const task = vi.fn().mockRejectedValue(new Error("down"));

    await expect(retryWithBackoff(task, { attempts: 3, sleep })).rejects.toThrow("down");
    expect(task).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("stops retrying once cancelled", async () => {
    const task = vi.fn().mockRejectedValue(new Error("down"));

    await expect(retryWithBackoff(task, { attempts: 5, isCancelled: () => true, sleep: async () => undefined })).rejects.toThrow("down");
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe("isNetworkFetchError", () => {
  it("recognises dropped-connection errors and ignores others", () => {
    expect(isNetworkFetchError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFetchError(new Error("Load failed"))).toBe(true);
    expect(isNetworkFetchError(new Error("Sync bootstrap failed with 401."))).toBe(false);
    expect(isNetworkFetchError("Failed to fetch")).toBe(false);
  });
});
