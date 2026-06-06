import type { FinanceSnapshot } from "@/types/finance";

export type ResolveFinanceId = (id: string | null | undefined) => string | null | undefined;

export type FinanceCommand = {
  id: string;
  apply: (snapshot: FinanceSnapshot, resolveId: ResolveFinanceId) => FinanceSnapshot;
  request: (resolveId: ResolveFinanceId) => Promise<FinanceSnapshot>;
  reconcile?: (
    previous: FinanceSnapshot | undefined,
    next: FinanceSnapshot,
    resolveId: ResolveFinanceId,
  ) => Array<readonly [optimisticId: string, serverId: string]>;
  onError?: (error: unknown) => void;
};

type PendingFinanceCommand = FinanceCommand & {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type CoordinatorOptions = {
  read: () => FinanceSnapshot | undefined;
  write: (snapshot: FinanceSnapshot) => void;
};

export class FinanceMutationCoordinator {
  private confirmed: FinanceSnapshot | undefined;
  private pending: PendingFinanceCommand[] = [];
  private aliases = new Map<string, string>();
  private processing = false;

  constructor(private readonly options: CoordinatorOptions) {}

  execute(command: FinanceCommand) {
    let resolveCompletion!: () => void;
    let rejectCompletion!: (error: unknown) => void;
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    // Commands are often intentionally fire-and-forget. Attach a rejection
    // handler while still returning the original promise to awaiting forms.
    void completion.catch(() => undefined);

    this.confirmed ??= this.options.read();
    this.pending.push({
      ...command,
      resolve: resolveCompletion,
      reject: rejectCompletion,
    });
    this.publish();
    void this.process();
    return completion;
  }

  private resolveId: ResolveFinanceId = (id) => {
    if (!id) return id;
    let resolved = id;
    const visited = new Set<string>();
    while (this.aliases.has(resolved) && !visited.has(resolved)) {
      visited.add(resolved);
      resolved = this.aliases.get(resolved)!;
    }
    return resolved;
  }

  private publish() {
    if (!this.confirmed) return;
    this.options.write(
      this.pending.reduce(
        (snapshot, command) => command.apply(snapshot, this.resolveId),
        this.confirmed,
      ),
    );
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.pending.length > 0) {
      const command = this.pending[0];

      try {
        const previous = this.confirmed;
        const next = await command.request(this.resolveId);
        for (const [optimisticId, serverId] of command.reconcile?.(
          previous,
          next,
          this.resolveId,
        ) ?? []) {
          this.aliases.set(optimisticId, serverId);
        }
        this.confirmed = next;
        command.resolve();
      } catch (error) {
        command.onError?.(error);
        command.reject(error);
      } finally {
        this.pending.shift();
        this.publish();
      }
    }

    this.processing = false;
    this.confirmed = this.options.read();
  }
}
