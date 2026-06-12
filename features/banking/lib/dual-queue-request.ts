export type CoordinatedQueue = "banking" | "finance";

export function createDualQueueRequest<T>(request: () => Promise<T>) {
  const readyQueues = new Set<CoordinatedQueue>();
  let started = false;
  let resolveResult!: (result: T) => void;
  let rejectResult!: (error: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  return (queue: CoordinatedQueue) => {
    readyQueues.add(queue);
    if (readyQueues.size === 2 && !started) {
      started = true;
      void request().then(resolveResult, rejectResult);
    }
    return result;
  };
}
