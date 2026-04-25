import type { TransactionSchedule, Transaction } from "@/types/finance";
import type {
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
} from "@/types/finance-schemas";

export type TransactionLineItemInput = {
  category_id: string | null;
  allocation_id: string | null;
  amount: number | null;
  note: string;
};

export type TransactionFormInputs = {
  title: string;
  note: string;
  occurred_at: string;
  status: "planned" | "paid";
  kind: Transaction["kind"];
  amount: number;
  destination_amount: number | null;
  fx_rate: number | null;
  principal_amount: number | null;
  interest_amount: number | null;
  extra_principal_amount: number | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  allocation_id: string | null;
  is_recurring: boolean;
  recurrence_frequency: TransactionSchedule["frequency"];
  recurrence_until: string | null;
  line_items: TransactionLineItemInput[];
  adjustment_target_balance: number | null;
};

export type RescheduleFrom = {
  scheduleId: string;
  originalDate: string;
  newDate: string;
};

export type TransactionFormSubmitPayload =
  | { kind: "entry"; values: TransactionEntryInput }
  | { kind: "entry-batch"; values: TransactionEntryBatchInput }
  | { kind: "transaction"; values: TransactionInput; rescheduleFrom?: RescheduleFrom }
  | { kind: "schedule"; values: TransactionScheduleInput };

export type TransactionFormMode = "add" | "edit-transaction" | "edit-schedule";

export type BatchKind = "income" | "expense" | "save_to_goal" | "spend_from_goal";
