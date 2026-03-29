import { z } from "zod";

import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { AccountType, AllocationKind, DebtKind } from "@/types/finance";

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

export type WalletInput = z.output<typeof walletInputSchema>;
export type WalletInputValues = z.input<typeof walletInputSchema>;
export type AllocationInput = z.output<typeof allocationInputSchema>;
export type AllocationInputValues = z.input<typeof allocationInputSchema>;
