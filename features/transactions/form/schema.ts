import { z } from "zod";

import type { TransactionFormMode } from "./types";
import { supportsBatchItems, isMoveKind } from "./helpers";
import { normalizeDebtPaymentBreakdown } from "./debt-payment-breakdown";

export type SchemaMessages = {
  validation: {
    noteMax: string;
    dateRequired: string;
    amountPositive: string;
    destinationAmountPositive: string;
    fxRatePositive: string;
    principalMin: string;
    interestMin: string;
    extraMin: string;
    sourceRequired: string;
    destinationRequired: string;
    categoryRequired: string;
    differentDestination: string;
    debtBreakdownRequired: string;
    debtBreakdownMismatch: string;
    destinationAmountRequired: string;
    lineItemsRequired: string;
    recurringMustBePlanned: string;
    recurrenceUntilBeforeStart: string;
  };
};

export function buildSchema(msgs: SchemaMessages, mode: TransactionFormMode) {
  const { validation: v } = msgs;
  const opaqueId = z.string().trim().min(1).nullable();
  const lineItemSchema = z.object({
    category_id: opaqueId,
    amount: z.number().positive(v.amountPositive).nullable(),
    note: z.string().trim().max(500, v.noteMax),
  });

  return z
    .object({
      title: z.string().trim(),
      note: z.string().trim().max(500, v.noteMax),
      occurred_at: z.string().trim().min(1, v.dateRequired),
      status: z.enum(["planned", "paid"]),
      kind: z.enum(["income", "expense", "transfer", "debt_payment"]),
      amount: z.number().min(0),
      destination_amount: z.number().positive(v.destinationAmountPositive).nullable(),
      fx_rate: z.number().positive(v.fxRatePositive).nullable(),
      principal_amount: z.number().min(0, v.principalMin).nullable(),
      interest_amount: z.number().min(0, v.interestMin).nullable(),
      extra_principal_amount: z.number().min(0, v.extraMin).nullable(),
      category_id: opaqueId,
      source_account_id: opaqueId,
      destination_account_id: opaqueId,
      allocation_id: opaqueId,
      investment_instrument_id: opaqueId,
      investment_units: z.number().positive(v.amountPositive).nullable(),
      is_recurring: z.boolean(),
      recurrence_frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      recurrence_interval_weeks: z.number().int().min(1),
      recurrence_until: z.string().trim().nullable(),
      line_items: z.array(lineItemSchema),
    })
    .superRefine((values, ctx) => {
      const batchMode = mode === "add" && supportsBatchItems(values.kind) && !values.investment_instrument_id;

      if (!batchMode && values.amount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: v.amountPositive });
      }

      const requireSource = ["expense", "transfer", "debt_payment"].includes(values.kind);
      const requireDestination = ["income", "transfer", "debt_payment"].includes(values.kind);

      if (requireSource && !values.source_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_account_id"], message: v.sourceRequired });
      }
      if (requireDestination && !values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: v.destinationRequired });
      }
      if (
        values.source_account_id &&
        values.destination_account_id &&
        values.source_account_id === values.destination_account_id &&
        !(values.kind === "transfer" && values.allocation_id)
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: v.differentDestination });
      }
      if (
        (values.kind === "income" || values.kind === "expense") &&
        !values.category_id &&
        !batchMode
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: v.categoryRequired });
      }
      if (batchMode) {
        if (!values.line_items.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items"], message: v.lineItemsRequired });
        }
        values.line_items.forEach((item, index) => {
          if (!item.amount) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items", index, "amount"], message: v.amountPositive });
          }
          if (!item.category_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items", index, "category_id"], message: v.categoryRequired });
          }
        });
      }
      if (values.kind === "debt_payment") {
        const breakdown = normalizeDebtPaymentBreakdown(values);
        const total = breakdown
          ? breakdown.principal_amount + breakdown.interest_amount + breakdown.extra_principal_amount
          : 0;

        if (!breakdown || total <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["principal_amount"], message: v.debtBreakdownRequired });
        }
        if (!breakdown || Math.abs(total - values.amount) > 0.01) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: v.debtBreakdownMismatch });
        }
      }
      if (isMoveKind(values.kind) && !batchMode && !values.destination_amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_amount"], message: v.destinationAmountRequired });
      }
      if (values.is_recurring && values.status !== "planned") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: v.recurringMustBePlanned });
      }
      if (values.is_recurring && values.recurrence_until && values.recurrence_until < values.occurred_at) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrence_until"], message: v.recurrenceUntilBeforeStart });
      }
      if (Boolean(values.investment_instrument_id) !== Boolean(values.investment_units)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["investment_units"], message: v.amountPositive });
      }
    });
}
