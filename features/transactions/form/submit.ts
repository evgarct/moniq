import type { Account, Allocation, Category } from "@/types/finance";
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
    allocation_id:
      values.kind === "save_to_goal" || values.kind === "spend_from_goal"
        ? (values.allocation_id ?? null)
        : null,
  };
}

export function inferBatchTitle(
  item: TransactionLineItemInput,
  kind: BatchKind,
  categories: Category[],
  allocations: Allocation[],
) {
  if (kind === "income" || kind === "expense") {
    return categories.find((c) => c.id === item.category_id)?.name ?? "";
  }
  return allocations.find((a) => a.id === item.allocation_id)?.name ?? "";
}

export function inferSingleTitle(
  values: TransactionFormInputs,
  accounts: Account[],
  categories: Category[],
  allocations: Allocation[],
) {
  if (
    values.kind === "income" ||
    values.kind === "expense" ||
    values.kind === "investment" ||
    values.kind === "refund"
  ) {
    return categories.find((c) => c.id === values.category_id)?.name ?? values.title.trim();
  }
  if (values.kind === "save_to_goal" || values.kind === "spend_from_goal") {
    return allocations.find((a) => a.id === values.allocation_id)?.name ?? values.title.trim();
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
  allocations: Allocation[],
  adjustmentTitle: string,
): TransactionFormSubmitPayload | null {
  if (values.kind === "adjustment" && mode === "add") {
    const account = accounts.find((a) => a.id === values.source_account_id);
    if (!account || values.adjustment_target_balance == null) return null;

    const diff = values.adjustment_target_balance - account.balance;
    if (Math.abs(diff) < 0.001) return null;

    return {
      kind: "entry",
      values: {
        title: adjustmentTitle,
        note: values.note.trim() || null,
        occurred_at: values.occurred_at,
        status: "paid",
        kind: "adjustment",
        amount: Math.abs(diff),
        destination_amount: null,
        fx_rate: null,
        principal_amount: null,
        interest_amount: null,
        extra_principal_amount: null,
        category_id: null,
        source_account_id: diff < 0 ? account.id : null,
        destination_account_id: diff > 0 ? account.id : null,
        allocation_id: null,
        recurrence: null,
      },
    };
  }

  if (supportsBatchItems(values.kind) && mode === "add") {
    const batchKind = values.kind;
    return {
      kind: "entry-batch",
      values: {
        entries: values.line_items.map((item) => ({
          ...normalizePayload({
            ...values,
            title: inferBatchTitle(item, batchKind, categories, allocations),
            note: item.note,
            amount: item.amount ?? 0,
            category_id: batchKind === "income" || batchKind === "expense" ? item.category_id : null,
            allocation_id: batchKind === "save_to_goal" || batchKind === "spend_from_goal" ? item.allocation_id : null,
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
    title: inferSingleTitle(values, accounts, categories, allocations),
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
