import type { FinanceSnapshot } from "@/types/finance";
import type { TransactionImportSnapshot } from "@/types/imports";

export type BankingCommandResult = {
  banking: TransactionImportSnapshot;
  finance?: FinanceSnapshot;
};

export type BankingCommand = {
  id: string;
  apply: (state: BankingCommandResult) => BankingCommandResult;
  request: () => Promise<BankingCommandResult>;
  onError?: (error: unknown) => void;
};

type PendingCommand = BankingCommand & {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type CoordinatorOptions = {
  readBanking: () => TransactionImportSnapshot | undefined;
  readFinance: () => FinanceSnapshot | undefined;
  writeBanking: (snapshot: TransactionImportSnapshot) => void;
  writeFinance: (snapshot: FinanceSnapshot) => void;
};

export class BankingMutationCoordinator {
  private confirmed: BankingCommandResult | undefined;
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

    this.confirmed ??= { banking, finance: this.options.readFinance() };
    this.pending.push({ ...command, resolve: resolveCompletion, reject: rejectCompletion });
    this.publish();
    void this.process();
    return completion;
  }

  private publish() {
    if (!this.confirmed) return;
    const next = this.pending.reduce(
      (state, command) => command.apply(state),
      this.confirmed,
    );
    this.options.writeBanking(next.banking);
    if (next.finance) {
      this.options.writeFinance(next.finance);
    }
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.pending.length > 0) {
      const command = this.pending[0];
      try {
        const next = await command.request();
        this.confirmed = {
          banking: next.banking,
          finance: next.finance ?? this.confirmed?.finance,
        };
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
    const banking = this.options.readBanking();
    this.confirmed = banking
      ? { banking, finance: this.options.readFinance() }
      : undefined;
  }
}
