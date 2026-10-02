/** One retry budget per authenticated session, shared by timer and reconnect events. */
export function createScheduleReconciliationRetry() {
  let reconciledMonth = "";
  let failures = 0;
  let retryAt = 0;
  return {
    shouldAttempt(month: string, now: number, reconnect = false) {
      return now >= retryAt && (reconnect || reconciledMonth !== month);
    },
    succeeded(month: string) {
      reconciledMonth = month;
      failures = 0;
      retryAt = 0;
    },
    failed(now: number) {
      failures += 1;
      retryAt = now + Math.min(5 * 60_000 * 2 ** Math.min(failures - 1, 4), 60 * 60_000);
      return failures === 1;
    },
  };
}
