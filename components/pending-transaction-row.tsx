"use client";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/finance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PickerCategory = Pick<Category, "id" | "name" | "icon" | "parent_id">;

export interface PendingTransactionRowProps {
  // Core data
  title: string;
  amount: number;
  currency: string | null;
  kind: "income" | "expense";
  occurredAt: string;

  // Category — pass categories already filtered by kind
  categories: PickerCategory[];
  resolvedCategoryId: string | null;
  suggestedCategoryName?: string | null;
  onCategoryChange: (id: string | null) => void;

  // Account (optional)
  accounts?: { id: string; name: string }[];
  resolvedAccountId?: string | null;
  onAccountChange?: (id: string | null) => void;

  // Optional kind picker (banking import — expense ↔ income)
  kindOptions?: { value: string; label: string }[];
  onKindChange?: (kind: string) => void;

  // Row state
  status?: "pending" | "approved" | "rejected";
  statusLabel?: string; // shown in secondary row when approved/rejected
  saving?: boolean;

  // Actions slot (approve/reject or confirm/delete buttons)
  actions?: React.ReactNode;

  // i18n
  selectCategoryPlaceholder?: string;
  noAccountPlaceholder?: string;
  clearCategoryLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number, currency: string | null, kind: "income" | "expense") {
  const sign = kind === "expense" ? "−" : "+";
  try {
    const formatted = currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
      : amount.toFixed(2);
    return `${sign}${formatted}`;
  } catch {
    return `${sign}${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  kindOptions,
  onKindChange,
  status = "pending",
  statusLabel,
  saving,
  actions,
  selectCategoryPlaceholder = "Select category",
  noAccountPlaceholder = "No account",
  clearCategoryLabel = "Uncategorized",
}: PendingTransactionRowProps) {
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const resolvedCategory = resolvedCategoryId
    ? (categories.find((c) => c.id === resolvedCategoryId) ?? null)
    : null;
  const resolvedAccount = resolvedAccountId
    ? (accounts.find((a) => a.id === resolvedAccountId) ?? null)
    : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-t border-border py-3 first:border-t-0",
        isRejected && "opacity-40",
      )}
    >
      {/* Left: category + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Primary: category (picker when pending, label when resolved) */}
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
            <CategoryIcon
              icon={resolvedCategory?.icon}
              glyphClassName="text-muted-foreground"
            />
            <span className="truncate type-body-14 font-medium text-foreground">
              {resolvedCategory?.name ?? selectCategoryPlaceholder}
            </span>
          </div>
        )}

        {/* Secondary: merchant · date · kind · account · hint · status */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 type-body-12 text-muted-foreground">
          <span className="max-w-[200px] truncate">{title}</span>
          <span>·</span>
          <span className="shrink-0">{formatDate(occurredAt)}</span>

          {/* Kind picker (banking import only) */}
          {kindOptions && onKindChange && (
            <>
              <span>·</span>
              <select
                value={kind}
                onChange={(e) => onKindChange(e.target.value)}
                className="m-0 appearance-none border-0 bg-transparent p-0 outline-none type-body-12 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                {kindOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Suggested category hint when unassigned */}
          {suggestedCategoryName && !resolvedCategoryId && isPending && (
            <>
              <span>·</span>
              <span className="italic opacity-70">{suggestedCategoryName}</span>
            </>
          )}

          {/* Account */}
          {accounts.length > 0 && isPending && onAccountChange ? (
            <>
              <span>·</span>
              <select
                value={resolvedAccountId ?? ""}
                onChange={(e) => onAccountChange(e.target.value || null)}
                className="m-0 appearance-none border-0 bg-transparent p-0 outline-none type-body-12 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                <option value="">{noAccountPlaceholder}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          ) : resolvedAccount ? (
            <>
              <span>·</span>
              <span>{resolvedAccount.name}</span>
            </>
          ) : null}

          {/* Resolved status label */}
          {!isPending && statusLabel && (
            <>
              <span>·</span>
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
          kind === "income"
            ? "text-emerald-600 dark:text-emerald-500"
            : "text-foreground",
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
