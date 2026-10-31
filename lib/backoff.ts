export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
};

/** Exponential delay for the n-th retry (0-based), capped at `maxMs`, with up to 20% jitter. */
export function backoffDelay(attempt: number, { baseMs = 1_000, maxMs = 60_000 }: BackoffOptions = {}, random: () => number = Math.random) {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exponential * (1 + random() * 0.2));
}

/**
 * Runs `task` up to `attempts` times, sleeping with exponential backoff between failures.
 * Rethrows the last error. `isCancelled` stops retrying early (e.g. provider unmounted).
 */
export async function retryWithBackoff<T>(
  task: (attempt: number) => Promise<T>,
  {
    attempts = 3,
    isCancelled = () => false,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ...backoff
  }: BackoffOptions & {
    attempts?: number;
    isCancelled?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (isCancelled() || attempt === attempts - 1) break;
      await sleep(backoffDelay(attempt, backoff));
    }
  }
  throw lastError;
}

/** Browsers surface a dropped connection as a bare "Failed to fetch" TypeError; detect it to show a friendly message. */
export function isNetworkFetchError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
}
