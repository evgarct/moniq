"use client";

import { ChevronDown } from "lucide-react";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { CategoryIcon } from "@/components/category-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Category, TransactionKind } from "@/types/finance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PickerCategory = Pick<Category, "id" | "name" | "icon" | "parent_id">;

export interface PendingTransactionRowProps {
  // Core data
  title: string;
  amount: number;
  currency: string | null;
  kind: TransactionKind;
  occurredAt: string;

  // Category — pass categories already filtered by kind
  categories: PickerCategory[];
  resolvedCategoryId: string | null;
  suggestedCategoryName?: string | null;
  onCategoryChange: (id: string | null) => void;

  // Accounts — source (debit) side
  accounts?: { id: string; name: string }[];
  resolvedAccountId?: string | null;
  onAccountChange?: (id: string | null) => void;

  // Accounts — destination (credit) side
  resolvedDestinationAccountId?: string | null;
  onDestinationAccountChange?: (id: string | null) => void;

  // Optional kind picker
  kindOptions?: { value: string; label: string }[];
  onKindChange?: (kind: string) => void;

  // Row state
  status?: "pending" | "approved" | "rejected";
  statusLabel?: string;
  saving?: boolean;

  // Actions slot
  actions?: React.ReactNode;

  // i18n
  selectCategoryPlaceholder?: string;
  sourceAccountPlaceholder?: string;
  destinationAccountPlaceholder?: string;
  noAccountPlaceholder?: string;
  clearCategoryLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREDIT_KINDS = new Set<TransactionKind>(["income", "refund", "adjustment"]);
const NEEDS_SOURCE = new Set<TransactionKind>(["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "investment", "adjustment"]);
const NEEDS_DESTINATION = new Set<TransactionKind>(["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "refund"]);

const EMPTY = "__none__";

function formatAmount(amount: number, currency: string | null, kind: TransactionKind) {
  const sign = CREDIT_KINDS.has(kind) ? "+" : "−";
  try {
    const numStr = currency
      ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      : amount.toFixed(2);
    const symbol = currency ? getCurrencySymbol(currency as CurrencyCode) : "";
    return `${sign}${numStr}${symbol ? `\u2009${symbol}` : ""}`;
  } catch {
    return `${sign}${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// InlinePicker — design-system Select styled for inline metadata rows
// ---------------------------------------------------------------------------

function InlinePicker({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Select
      value={value ?? EMPTY}
      onValueChange={(v) => onChange(v === EMPTY ? null : v)}
    >
      <SelectTrigger
        className={cn(
          "inline-flex h-auto w-auto items-center gap-0.5 border-0 bg-transparent p-0 text-xs shadow-none outline-none",
          "focus-visible:ring-0 focus-visible:border-transparent",
          "hover:text-foreground transition-colors",
          "data-placeholder:text-muted-foreground [&>svg:last-child]:hidden",
          value ? "text-muted-foreground" : "text-muted-foreground/60",
        )}
      >
        <SelectValue placeholder={placeholder} />
        <ChevronDown className="size-3 shrink-0 opacity-50" />
      </SelectTrigger>
      <SelectContent align="start" className="min-w-40">
        <SelectItem value={EMPTY} className="text-muted-foreground">
          {placeholder}
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PendingTransactionRow({
  title,
  amount,
  currency,
  kind,
  occurredAt,
  categories,
  resolvedCategoryId,
  suggestedCategoryName,
  onCategoryChange,
  accounts = [],
  resolvedAccountId = null,
  onAccountChange,
  resolvedDestinationAccountId = null,
  onDestinationAccountChange,
  kindOptions,
  onKindChange,
  status = "pending",
  statusLabel,
  saving,
  actions,
  selectCategoryPlaceholder = "Select category",
  sourceAccountPlaceholder = "From account",
  destinationAccountPlaceholder = "To account",
  noAccountPlaceholder = "No account",
  clearCategoryLabel = "Uncategorized",
}: PendingTransactionRowProps) {
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const needsSource = NEEDS_SOURCE.has(kind);
  const needsDestination = NEEDS_DESTINATION.has(kind);

  const resolvedCategory = resolvedCategoryId
    ? (categories.find((c) => c.id === resolvedCategoryId) ?? null)
    : null;
  const resolvedSourceAccount = resolvedAccountId
    ? (accounts.find((a) => a.id === resolvedAccountId) ?? null)
    : null;
  const resolvedDestAccount = resolvedDestinationAccountId
    ? (accounts.find((a) => a.id === resolvedDestinationAccountId) ?? null)
    : null;

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-t border-border py-3 first:border-t-0",
        isRejected && "opacity-40",
      )}
    >
      {/* Left: category + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Primary: category picker when pending, label when resolved */}
        {isPending ? (
          <CategoryCascadePicker
            categories={categories}
            value={resolvedCategoryId}
            onSelect={onCategoryChange}
            placeholder={selectCategoryPlaceholder}
            clearLabel={clearCategoryLabel}
            triggerClassName={cn(
              "h-auto w-full justify-start py-0 px-0 type-body-14 font-medium outline-none transition-opacity hover:opacity-70",
              resolvedCategoryId ? "text-foreground" : "text-muted-foreground",
            )}
            contentClassName="min-w-[14rem]"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <CategoryIcon icon={resolvedCategory?.icon} glyphClassName="text-muted-foreground" />
            <span className="truncate type-body-14 font-medium text-foreground">
              {resolvedCategory?.name ?? selectCategoryPlaceholder}
            </span>
          </div>
        )}

        {/* Secondary metadata row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 type-body-12 text-muted-foreground">
          <span className="max-w-[200px] truncate">{title}</span>
          <span className="opacity-40">·</span>
          <span className="shrink-0">{formatDate(occurredAt)}</span>

          {/* Kind picker */}
          {kindOptions && onKindChange && isPending && (
            <>
              <span className="opacity-40">·</span>
              <InlinePicker
                value={kind}
                onChange={(v) => v && onKindChange(v)}
                options={kindOptions}
                placeholder={kind}
              />
            </>
          )}

          {/* Suggested category hint */}
          {suggestedCategoryName && !resolvedCategoryId && isPending && (
            <>
              <span className="opacity-40">·</span>
              <span className="italic opacity-60">{suggestedCategoryName}</span>
            </>
          )}

          {/* Source account */}
          {needsSource && accounts.length > 0 && (
            <>
              <span className="opacity-40">·</span>
              {isPending && onAccountChange ? (
                <InlinePicker
                  value={resolvedAccountId}
                  onChange={onAccountChange}
                  options={accountOptions}
                  placeholder={sourceAccountPlaceholder}
                />
              ) : resolvedSourceAccount ? (
                <span>{resolvedSourceAccount.name}</span>
              ) : (
                <span className="opacity-40">{sourceAccountPlaceholder}</span>
              )}
            </>
          )}

          {/* Destination account */}
          {needsDestination && accounts.length > 0 && (
            <>
              <span className={needsSource ? "" : "opacity-40"}>{needsSource ? "→" : "·"}</span>
              {isPending && onDestinationAccountChange ? (
                <InlinePicker
                  value={resolvedDestinationAccountId}
                  onChange={onDestinationAccountChange}
                  options={accountOptions}
                  placeholder={destinationAccountPlaceholder}
                />
              ) : resolvedDestAccount ? (
                <span>{resolvedDestAccount.name}</span>
              ) : (
                <span className="opacity-40">{destinationAccountPlaceholder}</span>
              )}
            </>
          )}

          {/* Legacy single-account fallback (banking-view usage without source/dest distinction) */}
          {!needsSource && !needsDestination && accounts.length > 0 && isPending && onAccountChange && (
            <>
              <span className="opacity-40">·</span>
              <InlinePicker
                value={resolvedAccountId}
                onChange={onAccountChange}
                options={accountOptions}
                placeholder={noAccountPlaceholder}
              />
            </>
          )}

          {/* Status label when resolved */}
          {!isPending && statusLabel && (
            <>
              <span className="opacity-40">·</span>
              <span
                className={cn(
                  isApproved && "text-emerald-600 dark:text-emerald-500",
                  isRejected && "text-destructive",
                )}
              >
                {statusLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <span
        className={cn(
          "shrink-0 pt-0.5 tabular-nums type-body-14 font-semibold",
          CREDIT_KINDS.has(kind) ? "text-emerald-600 dark:text-emerald-500" : "text-foreground",
          saving && "opacity-50",
        )}
      >
        {formatAmount(amount, currency, kind)}
      </span>

      {/* Actions */}
      {actions && (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      )}
    </div>
  );
}
