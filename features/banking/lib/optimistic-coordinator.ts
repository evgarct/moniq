import type { TransactionImportSnapshot } from "@/types/imports";

export type BankingCommand = {
  id: string;
  apply: (snapshot: TransactionImportSnapshot) => TransactionImportSnapshot;
  request: () => Promise<TransactionImportSnapshot>;
  onError?: (error: unknown) => void;
};

type PendingCommand = BankingCommand & {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type CoordinatorOptions = {
  readBanking: () => TransactionImportSnapshot | undefined;
  writeBanking: (snapshot: TransactionImportSnapshot) => void;
};

export class BankingMutationCoordinator {
  private confirmed: TransactionImportSnapshot | undefined;
  private pending: PendingCommand[] = [];
  private processing = false;

  constructor(private readonly options: CoordinatorOptions) {}

  execute(command: BankingCommand) {
    let resolveCompletion!: () => void;
    let rejectCompletion!: (error: unknown) => void;
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    void completion.catch(() => undefined);

    const banking = this.options.readBanking();
    if (!banking) {
      const error = new Error();
      command.onError?.(error);
      rejectCompletion(error);
      return completion;
    }

    this.confirmed ??= banking;
    this.pending.push({ ...command, resolve: resolveCompletion, reject: rejectCompletion });
    this.publish();
    void this.process();
    return completion;
  }

  private publish() {
    if (!this.confirmed) return;
    const next = this.pending.reduce(
      (snapshot, command) => command.apply(snapshot),
      this.confirmed,
    );
    this.options.writeBanking(next);
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.pending.length > 0) {
      const command = this.pending[0];
      try {
        const next = await command.request();
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
    this.confirmed = this.options.readBanking();
  }
}
