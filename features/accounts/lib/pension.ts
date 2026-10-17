import { z } from "zod";
import type { Account, PensionEntry, PensionStatement, Transaction } from "@/types/finance";

export const pensionStatementSchema = z.object({
  product_type: z.literal("cz_dps").optional(),
  as_of: z.string().date(),
  total_value: z.number().finite().nonnegative(),
  invested: z.number().finite().nonnegative().nullable().optional(),
  provider_result: z.number().finite().nullable().optional(),
  entries: z.array(z.object({
    id: z.string().min(1), occurred_at: z.string().date(), amount: z.number().finite().positive(),
    source: z.enum(["own", "employer", "state", "internal_investment"]), transaction_id: z.string().uuid().nullable().optional(),
  })).default([]),
}).superRefine((value, ctx) => {
  if (value.as_of > new Date().toISOString().slice(0, 10)) ctx.addIssue({ code: "custom", path: ["as_of"], message: "invalid_date" });
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (ids.has(entry.id) || entry.occurred_at > value.as_of || (entry.source === "own" && !entry.transaction_id)) ctx.addIssue({ code: "custom", path: ["entries"], message: "invalid_entry" });
    ids.add(entry.id);
  }
});
export type PensionStatementInput = z.infer<typeof pensionStatementSchema>;

export function pensionBalance(statement: PensionStatement, entries: PensionEntry[], transactions: Transaction[], walletId: string) {
  const external = entries.filter((entry) => (entry.source === "employer" || entry.source === "state") && entry.occurred_at > statement.as_of).reduce((sum, entry) => sum + entry.amount, 0);
  const own = transactions.filter((tx) => tx.destination_account_id === walletId && tx.status === "paid" && tx.occurred_at > statement.as_of).reduce((sum, tx) => sum + (tx.destination_amount ?? tx.amount), 0);
  return Number((statement.total_value + external + own).toFixed(2));
}

export function applyPensionStatement(account: Account, statement: PensionStatementInput, transactions: Transaction[]): Account {
  const entries = [...(account.pension_state?.entries ?? [])];
  for (const entry of statement.entries) {
    const old = entries.find((item) => item.id === entry.id);
    if (old && JSON.stringify(old) !== JSON.stringify(entry)) throw new Error("pension_entry_conflict");
    if (!old) entries.push(entry);
  }
  const { entries: ignored, ...valuation } = statement;
  void ignored;
  const statements = [...(account.pension_state?.statements ?? []).filter((item) => item.as_of !== statement.as_of), valuation].sort((a, b) => a.as_of.localeCompare(b.as_of));
  return { ...account, pension_state: { product_type: account.pension_state?.product_type ?? statement.product_type, statements, entries }, balance: pensionBalance(statements.at(-1)!, entries, transactions, account.id) };
}
