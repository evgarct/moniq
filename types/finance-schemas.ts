import { z } from "zod";

import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { AccountType, DebtKind } from "@/types/finance";

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, "Wallet name is required."),
  type: z.enum(["cash", "saving", "credit_card", "debt"] satisfies [AccountType, ...AccountType[]]),
  balance: z.number(),
  currency: z.enum(SUPPORTED_CURRENCY_CODES),
  debt_kind: z.enum(["loan", "mortgage", "personal"] satisfies [DebtKind, ...DebtKind[]]).optional().nullable(),
});

export const allocationInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  amount: z.number().min(0, "Amount cannot go below 0."),
});

export type WalletInput = z.output<typeof walletInputSchema>;
export type WalletInputValues = z.input<typeof walletInputSchema>;
export type AllocationInput = z.output<typeof allocationInputSchema>;
export type AllocationInputValues = z.input<typeof allocationInputSchema>;

