"use client";

import { Pencil, Plus, Target, Trash2 } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { WalletAllocation } from "@/types/finance";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const done = percent >= 100;

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
      <div
        className={cn("h-full rounded-full transition-[width,background-color]", done ? "bg-emerald-500" : "bg-foreground/35")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function GoalsPanel({
  balance,
  currency,
  allocations,
  onAdd,
  onEdit,
  onDelete,
}: {
  balance: number;
  currency: CurrencyCode;
  allocations: WalletAllocation[];
  onAdd?: () => void;
  onEdit?: (allocation: WalletAllocation) => void;
  onDelete?: (allocation: WalletAllocation) => void;
}) {
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const free = balance - totalAllocated;
  const isOverfunded = free < -0.001;

  return (
    <section className="mt-8 flex flex-col gap-2 sm:mt-10 sm:gap-2.5">
      <div className="flex items-center justify-between gap-3 px-1.5 sm:px-2.5">
        <h2 className="font-heading text-[20px] leading-[1.12] tracking-[-0.028em] text-foreground sm:type-h3">
          Goals
        </h2>
        {onAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
            aria-label="Add goal"
            onClick={onAdd}
          >
            <Plus />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 sm:gap-1">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 rounded-sm px-1.5 py-1.5 sm:gap-3 sm:px-2.5 sm:py-2.5">
          <span className="text-[13px] leading-[18px] text-muted-foreground sm:type-body-14">
            Free
          </span>
          <div className="flex items-center justify-end gap-1.5">
            {isOverfunded ? (
              <span className="text-[11px] leading-none text-destructive/70">over</span>
            ) : null}
            <MoneyAmount
              amount={free}
              currency={currency}
              tone={isOverfunded ? "negative" : "muted"}
              display="absolute"
              showMinorUnits
              className="text-[13px] leading-[18px] font-medium sm:text-[14px] sm:leading-5"
            />
          </div>
        </div>

        {allocations.map((allocation) => {
          const progressPercent =
            allocation.kind === "goal_targeted" && allocation.target_amount
              ? Math.min(100, Math.round((allocation.amount / allocation.target_amount) * 100))
              : null;

          return (
            <div
              key={allocation.id}
              className="group rounded-sm px-1.5 py-1.5 transition-colors hover:bg-[#ece8e1] sm:px-2.5 sm:py-2.5"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  {allocation.kind === "goal_targeted" ? (
                    <Target className="size-3.5 shrink-0 text-muted-foreground/60" />
                  ) : null}
                  <span className="truncate text-[13px] leading-[18px] font-medium tracking-[0.01em] text-foreground sm:type-h6">
                    {allocation.name}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 shrink-0 rounded-[var(--radius-control)] bg-transparent text-muted-foreground hover:bg-[#e6e1d9] hover:text-foreground"
                        aria-label={`Edit ${allocation.name}`}
                        onClick={() => onEdit(allocation)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 shrink-0 rounded-[var(--radius-control)] bg-transparent text-muted-foreground hover:bg-[#e6e1d9] hover:text-destructive"
                        aria-label={`Delete ${allocation.name}`}
                        onClick={() => onDelete(allocation)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    ) : null}
                  </div>
                  <MoneyAmount
                    amount={allocation.amount}
                    currency={currency}
                    display="absolute"
                    showMinorUnits
                    className="text-[13px] leading-[18px] font-medium sm:text-[14px] sm:leading-5"
                  />
                </div>
              </div>

              {allocation.kind === "goal_targeted" && allocation.target_amount ? (
                <div className="mt-2 space-y-1 pl-6">
                  <ProgressBar value={allocation.amount} max={allocation.target_amount} />
                  <div className="flex justify-between text-[11px] leading-none text-muted-foreground/70">
                    <span>{progressPercent}%</span>
                    <MoneyAmount
                      amount={allocation.target_amount}
                      currency={currency}
                      display="absolute"
                      showMinorUnits={false}
                      tone="muted"
                      className="text-[11px] leading-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
