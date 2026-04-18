import type { Transaction } from "@/types/finance";
import type { BatchKind, TransactionLineItemInput } from "./types";

export function supportsBatchItems(kind: Transaction["kind"]): kind is BatchKind {
  return kind === "income" || kind === "expense" || kind === "save_to_goal" || kind === "spend_from_goal";
}

export function isMoveKind(kind: Transaction["kind"]) {
  return kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal";
}

export function createEmptyLineItem(): TransactionLineItemInput {
  return { category_id: null, allocation_id: null, amount: null, note: "" };
}

export function toSelectValue(value: string | null | undefined) {
  return value ?? "";
}
