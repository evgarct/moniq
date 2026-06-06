import type { FinanceSnapshot } from "@/types/finance";

export type FinanceCommand = {
  id: string;
  apply: (snapshot: FinanceSnapshot) => FinanceSnapshot;
  request: () => Promise<FinanceSnapshot>;
  onError?: (error: unknown) => void;
};

type CoordinatorOptions = {
  read: () => FinanceSnapshot | undefined;
  write: (snapshot: FinanceSnapshot) => void;
};

export class FinanceMutationCoordinator {
  private confirmed: FinanceSnapshot | undefined;
  private pending: FinanceCommand[] = [];
  private processing = false;

  constructor(private readonly options: CoordinatorOptions) {}

  execute(command: FinanceCommand) {
    this.confirmed ??= this.options.read();
    this.pending.push(command);
    this.publish();
    void this.process();
  }

  private publish() {
    if (!this.confirmed) return;
    this.options.write(this.pending.reduce((snapshot, command) => command.apply(snapshot), this.confirmed));
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.pending.length > 0) {
      const command = this.pending[0];

      try {
        this.confirmed = await command.request();
      } catch (error) {
        command.onError?.(error);
      } finally {
        this.pending.shift();
        this.publish();
      }
    }

    this.processing = false;
    this.confirmed = this.options.read();
  }
}
