import type { Account, Category } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";
import { isMoveKind, supportsBatchItems } from "./helpers";
import type { BatchKind, TransactionFormInputs, TransactionFormMode, TransactionFormSubmitPayload, TransactionLineItemInput } from "./types";

export function normalizePayload(values: TransactionFormInputs): TransactionInput {
  return {
    title: values.title.trim(),
    note: values.note.trim() ? values.note.trim() : null,
    occurred_at: values.occurred_at,
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: isMoveKind(values.kind) ? (values.destination_amount ?? values.amount) : null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.kind === "debt_payment" ? (values.principal_amount ?? 0) : null,
    interest_amount: values.kind === "debt_payment" ? (values.interest_amount ?? 0) : null,
    extra_principal_amount: values.kind === "debt_payment" ? (values.extra_principal_amount ?? 0) : null,
    category_id: isMoveKind(values.kind) ? null : (values.category_id ?? null),
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
  };
}

export function inferBatchTitle(
  item: TransactionLineItemInput,
  _kind: BatchKind,
  categories: Category[],
) {
  return categories.find((c) => c.id === item.category_id)?.name ?? "";
}

export function inferSingleTitle(
  values: TransactionFormInputs,
  accounts: Account[],
  categories: Category[],
) {
  if (values.kind === "income" || values.kind === "expense") {
    return categories.find((c) => c.id === values.category_id)?.name ?? values.title.trim();
  }
  if (values.kind === "transfer") {
    const source = accounts.find((a) => a.id === values.source_account_id)?.name;
    const destination = accounts.find((a) => a.id === values.destination_account_id)?.name;
    return source && destination ? `${source} → ${destination}` : values.title.trim();
  }
  if (values.kind === "debt_payment") {
    return accounts.find((a) => a.id === values.destination_account_id)?.name ?? values.title.trim();
  }
  return values.title.trim();
}

export function buildSubmitPayload(
  values: TransactionFormInputs,
  mode: TransactionFormMode,
  accounts: Account[],
  categories: Category[],
): TransactionFormSubmitPayload | null {
  if (supportsBatchItems(values.kind) && mode === "add" && values.line_items.length > 0) {
    const batchKind = values.kind;
    return {
      kind: "entry-batch",
      values: {
        entries: values.line_items.map((item) => ({
          ...normalizePayload({
            ...values,
            title: inferBatchTitle(item, batchKind, categories),
            note: item.note,
            amount: item.amount ?? 0,
            category_id: item.category_id,
            status: values.is_recurring ? "planned" : values.status,
          }),
          recurrence: values.is_recurring
            ? {
                frequency: values.recurrence_frequency,
                until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
              }
            : null,
        })),
      },
    };
  }

  const payload = normalizePayload({
    ...values,
    title: inferSingleTitle(values, accounts, categories),
    status: values.is_recurring ? "planned" : values.status,
  });

  if (mode === "edit-schedule") {
    return {
      kind: "schedule",
      values: {
        ...payload,
        recurrence: {
          frequency: values.recurrence_frequency,
          until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
        },
      },
    };
  }

  if (mode === "edit-transaction") {
    return { kind: "transaction", values: payload };
  }

  return {
    kind: "entry",
    values: {
      ...payload,
      recurrence: values.is_recurring
        ? {
            frequency: values.recurrence_frequency,
            until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
          }
        : null,
    },
  };
}
