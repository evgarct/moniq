import type { Transaction } from "@/types/finance";
import type { BatchKind, TransactionLineItemInput } from "./types";

export function supportsBatchItems(kind: Transaction["kind"]): kind is BatchKind {
  return kind === "income" || kind === "expense";
}

export function isMoveKind(kind: Transaction["kind"]) {
  return kind === "transfer";
}

export function createEmptyLineItem(): TransactionLineItemInput {
  return { category_id: null, amount: null, note: "" };
}

export function toSelectValue(value: string | null | undefined) {
  return value ?? "";
}
