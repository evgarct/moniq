import { z } from "zod";

import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type {
  AccountType,
  CategoryType,
  DebtKind,
  TransactionKind,
  TransactionScheduleFrequency,
  TransactionScheduleState,
} from "@/types/finance";

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, "Wallet name is required."),
  type: z.enum(["cash", "saving", "credit_card", "debt"] satisfies [AccountType, ...AccountType[]]),
  balance: z.number(),
  credit_limit: z.number().positive("Credit limit must be greater than 0.").nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCY_CODES),
  debt_kind: z.enum(["loan", "mortgage", "personal"] satisfies [DebtKind, ...DebtKind[]]).optional().nullable(),
}).superRefine((values, ctx) => {
  if (values.type === "credit_card" && (values.credit_limit == null || values.credit_limit <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["credit_limit"],
      message: "Credit limit is required for a credit card.",
    });
  }

  if (
    values.type === "credit_card" &&
    values.credit_limit != null &&
    Math.abs(values.balance) - values.credit_limit > 0.01
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["balance"],
      message: "Current balance cannot exceed the credit limit.",
    });
  }
}).transform((values) => ({
  ...values,
  credit_limit: values.type === "credit_card" ? values.credit_limit ?? null : null,
}));

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Category name is required."),
  icon: z.string().trim().max(48, "Use a short icon token.").nullable().optional(),
  type: z.enum(["income", "expense"] satisfies [CategoryType, ...CategoryType[]]),
  parent_id: z.string().uuid().nullable().optional(),
});

const transactionFieldShape = {
  title: z.string().trim().min(1, "Title is required."),
  note: z.string().trim().max(500, "Note is too long.").nullable().optional(),
  occurred_at: z.string().trim().min(1, "Date is required."),
  status: z.enum(["planned", "paid"] satisfies ["planned", "paid"]),
  kind: z.enum(
    ["income", "expense", "transfer", "debt_payment"] satisfies [TransactionKind, ...TransactionKind[]],
  ),
  amount: z.number().positive("Amount must be greater than 0."),
  destination_amount: z.number().positive("Destination amount must be greater than 0.").nullable().optional(),
  fx_rate: z.number().positive("FX rate must be greater than 0.").nullable().optional(),
  principal_amount: z.number().min(0, "Principal cannot be negative.").nullable().optional(),
  interest_amount: z.number().min(0, "Interest cannot be negative.").nullable().optional(),
  extra_principal_amount: z.number().min(0, "Extra principal cannot be negative.").nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  source_account_id: z.string().uuid().nullable().optional(),
  destination_account_id: z.string().uuid().nullable().optional(),
} as const;

function addTransactionValidation<
  T extends z.ZodType<{
    kind: TransactionKind;
    amount: number;
    destination_amount?: number | null;
    principal_amount?: number | null;
    interest_amount?: number | null;
    extra_principal_amount?: number | null;
    category_id?: string | null;
    source_account_id?: string | null;
    destination_account_id?: string | null;
  }>
>(schema: T) {
  return schema.superRefine((values, ctx) => {
    const requireSource = values.kind === "expense" || values.kind === "transfer" || values.kind === "debt_payment";
    const requireDestination = values.kind === "income" || values.kind === "transfer" || values.kind === "debt_payment";
    const requireCategory = values.kind === "income" || values.kind === "expense";

    if (requireSource && !values.source_account_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_account_id"], message: "Choose the source account." });
    }

    if (requireDestination && !values.destination_account_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: "Choose the destination account." });
    }

    if (requireCategory && !values.category_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: "Choose a category." });
    }

    if (values.kind === "transfer" && values.category_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: "Transfers do not use a category." });
    }

    if (values.source_account_id && values.destination_account_id && values.source_account_id === values.destination_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_account_id"],
        message: "Choose a different destination account.",
      });
    }

    if (values.kind === "debt_payment") {
      const principal = values.principal_amount ?? 0;
      const interest = values.interest_amount ?? 0;
      const extra = values.extra_principal_amount ?? 0;
      const breakdownTotal = principal + interest + extra;

      if (breakdownTotal <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["principal_amount"], message: "Provide at least one debt payment amount." });
      }

      if (Math.abs(breakdownTotal - values.amount) > 0.01) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Amount must equal principal + interest + extra principal." });
      }
    }

    if (values.kind === "transfer" && !values.destination_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_amount"],
        message: "Destination amount is required for account-to-account moves.",
      });
    }
  });
}

function normalizeTransactionValues<
  T extends {
    note?: string | null;
    kind: TransactionKind;
    amount: number;
    destination_amount?: number | null;
    fx_rate?: number | null;
    principal_amount?: number | null;
    interest_amount?: number | null;
    extra_principal_amount?: number | null;
    category_id?: string | null;
  }
>(values: T) {
  return {
    ...values,
    note: values.note?.trim() ? values.note.trim() : null,
    destination_amount: values.kind === "transfer" ? values.destination_amount ?? values.amount : null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.kind === "debt_payment" ? values.principal_amount ?? 0 : null,
    interest_amount: values.kind === "debt_payment" ? values.interest_amount ?? 0 : null,
    extra_principal_amount: values.kind === "debt_payment" ? values.extra_principal_amount ?? 0 : null,
    category_id: values.kind === "transfer" ? null : values.category_id ?? null,
  };
}

export const transactionInputSchema = addTransactionValidation(z.object(transactionFieldShape)).transform((values) =>
  normalizeTransactionValues(values),
);

export const transactionRecurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"] satisfies [TransactionScheduleFrequency, ...TransactionScheduleFrequency[]]),
  until_date: z.string().trim().min(1, "Until date is required.").nullable().optional(),
});

export const transactionEntryInputSchema = addTransactionValidation(
  z.object(transactionFieldShape).extend({
    recurrence: transactionRecurrenceSchema.nullable().optional(),
  }),
)
  .superRefine((values, ctx) => {
    if (values.recurrence && values.status !== "planned") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Recurring transactions must start as planned.",
      });
    }
  })
  .transform((values) => normalizeTransactionValues(values));

export const transactionEntryBatchInputSchema = z.object({
  entries: z.array(transactionEntryInputSchema).min(1, "At least one transaction is required."),
});

export const transactionScheduleInputSchema = addTransactionValidation(
  z
    .object(transactionFieldShape)
    .omit({
      status: true,
    })
    .extend({
      recurrence: transactionRecurrenceSchema,
    }),
).transform((values) => normalizeTransactionValues(values));

export const transactionScheduleStateInputSchema = z.object({
  state: z.enum(["active", "paused"] satisfies [TransactionScheduleState, ...TransactionScheduleState[]]),
});

export type WalletInput = z.output<typeof walletInputSchema>;
export type WalletInputValues = z.input<typeof walletInputSchema>;
export type CategoryInput = z.output<typeof categoryInputSchema>;
export type CategoryInputValues = z.input<typeof categoryInputSchema>;
export type TransactionInput = z.output<typeof transactionInputSchema>;
export type TransactionInputValues = z.input<typeof transactionInputSchema>;
export type TransactionEntryInput = z.output<typeof transactionEntryInputSchema>;
export type TransactionEntryInputValues = z.input<typeof transactionEntryInputSchema>;
export type TransactionEntryBatchInput = z.output<typeof transactionEntryBatchInputSchema>;
export type TransactionEntryBatchInputValues = z.input<typeof transactionEntryBatchInputSchema>;
export type TransactionScheduleInput = z.output<typeof transactionScheduleInputSchema>;
export type TransactionScheduleInputValues = z.input<typeof transactionScheduleInputSchema>;
export type TransactionScheduleStateInput = z.output<typeof transactionScheduleStateInputSchema>;
