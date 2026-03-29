import { z } from "zod";

import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { AccountType, AllocationKind, CategoryType, DebtKind, TransactionKind, TransactionStatus } from "@/types/finance";

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, "Wallet name is required."),
  type: z.enum(["cash", "saving", "credit_card", "debt"] satisfies [AccountType, ...AccountType[]]),
  balance: z.number(),
  currency: z.enum(SUPPORTED_CURRENCY_CODES),
  debt_kind: z.enum(["loan", "mortgage", "personal"] satisfies [DebtKind, ...DebtKind[]]).optional().nullable(),
});

export const allocationInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    amount: z.number().min(0, "Amount cannot go below 0."),
    kind: z.enum(["goal_open", "goal_targeted"] satisfies [AllocationKind, ...AllocationKind[]]),
    target_amount: z.number().positive("Target amount must be greater than 0.").nullable().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "goal_targeted" && (values.target_amount == null || values.target_amount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_amount"],
        message: "Target amount is required for a targeted goal.",
      });
    }
  })
  .transform((values) => ({
    ...values,
    target_amount: values.kind === "goal_targeted" ? values.target_amount ?? null : null,
  }));

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Category name is required."),
  icon: z.string().trim().max(8, "Use a short emoji or icon token.").nullable().optional(),
  type: z.enum(["income", "expense"] satisfies [CategoryType, ...CategoryType[]]),
  parent_id: z.string().uuid().nullable().optional(),
});

export const transactionInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required."),
    note: z.string().trim().max(500, "Note is too long.").nullable().optional(),
    occurred_at: z.string().trim().min(1, "Date is required."),
    status: z.enum(["planned", "paid"] satisfies [TransactionStatus, ...TransactionStatus[]]),
    kind: z.enum(
      ["income", "expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"] satisfies [
        TransactionKind,
        ...TransactionKind[],
      ],
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
    allocation_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((values, ctx) => {
    const requireSource = values.kind === "expense" || values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" || values.kind === "debt_payment";
    const requireDestination =
      values.kind === "income" || values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" || values.kind === "debt_payment";
    const requireCategory = values.kind === "income" || values.kind === "expense";

    if (requireSource && !values.source_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_account_id"],
        message: "Choose the source account.",
      });
    }

    if (requireDestination && !values.destination_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_account_id"],
        message: "Choose the destination account.",
      });
    }

    if (requireCategory && !values.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Choose a category.",
      });
    }

    if (values.kind === "transfer" && values.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_id"],
        message: "Transfers do not use a category.",
      });
    }

    if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !values.allocation_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allocation_id"],
        message: "Choose the savings goal.",
      });
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["principal_amount"],
          message: "Provide at least one debt payment amount.",
        });
      }

      if (Math.abs(breakdownTotal - values.amount) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Amount must equal principal + interest + extra principal.",
        });
      }
    }

    const requiresDestinationAmount = values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal";

    if (requiresDestinationAmount && !values.destination_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_amount"],
        message: "Destination amount is required for account-to-account moves.",
      });
    }
  })
  .transform((values) => ({
    ...values,
    note: values.note?.trim() ? values.note.trim() : null,
    destination_amount:
      values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal"
        ? values.destination_amount ?? values.amount
        : null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.kind === "debt_payment" ? values.principal_amount ?? 0 : null,
    interest_amount: values.kind === "debt_payment" ? values.interest_amount ?? 0 : null,
    extra_principal_amount: values.kind === "debt_payment" ? values.extra_principal_amount ?? 0 : null,
    category_id: values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" ? null : values.category_id ?? null,
    allocation_id: values.kind === "save_to_goal" || values.kind === "spend_from_goal" ? values.allocation_id ?? null : null,
  }));

export type WalletInput = z.output<typeof walletInputSchema>;
export type WalletInputValues = z.input<typeof walletInputSchema>;
export type AllocationInput = z.output<typeof allocationInputSchema>;
export type AllocationInputValues = z.input<typeof allocationInputSchema>;
export type CategoryInput = z.output<typeof categoryInputSchema>;
export type CategoryInputValues = z.input<typeof categoryInputSchema>;
export type TransactionInput = z.output<typeof transactionInputSchema>;
export type TransactionInputValues = z.input<typeof transactionInputSchema>;
