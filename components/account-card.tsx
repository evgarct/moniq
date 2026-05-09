import { useState } from "react";
import { BanknoteArrowDown, CreditCard, Landmark, Pencil, PencilLine, PiggyBank, Plus, SlidersHorizontal, Target, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import { InlineIcon } from "@/components/ui/inline-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCreditCardMetrics, isCreditCardAccount, isDebtAccount } from "@/features/accounts/lib/account-utils";
import { cn } from "@/lib/utils";
import type { Account, WalletAllocation } from "@/types/finance";

export function AccountCard({
  account,
  selected = false,
  onSelect,
  showMinorUnits = true,
  onEdit,
  onDelete,
  onAdjustBalance,
  allocations,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
}: {
  account: Account;
  selected?: boolean;
  onSelect?: () => void;
  showMinorUnits?: boolean;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAdjustBalance?: (account: Account, newBalance: number) => void;
  allocations?: WalletAllocation[];
  onAddGoal?: () => void;
  onEditGoal?: (allocation: WalletAllocation) => void;
  onDeleteGoal?: (allocation: WalletAllocation) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const debt = isDebtAccount(account);
  const creditCard = isCreditCardAccount(account);
  const creditCardMetrics = creditCard ? getCreditCardMetrics(account) : null;
  const detailLabel =
    account.type === "debt"
      ? t(`walletTypes.${account.debt_kind ?? "debt"}` as const)
      : null;
  const AccountIcon =
    account.type === "saving"
      ? PiggyBank
      : account.type === "credit_card"
        ? CreditCard
        : account.type === "debt"
          ? Landmark
          : BanknoteArrowDown;
  const hasActions = Boolean(onEdit || onDelete || onAdjustBalance);
  const [contextAnchor, setContextAnchor] = useState<{ x: number; y: number } | null>(null);
  const showGoals = account.type === "saving" && allocations !== undefined;
  const totalAllocated = showGoals ? (allocations ?? []).reduce((sum, a) => sum + a.amount, 0) : 0;
  const free = account.balance - totalAllocated;
  const isOverfunded = free < -0.001;

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (!hasActions) {
      return;
    }

    event.preventDefault();
    setContextAnchor({ x: event.clientX, y: Math.max(event.clientY - 6, 0) });
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(
        "relative rounded-sm transition-[background-color,color]",
        selected
          ? "bg-[#e6e1d9] text-foreground"
          : "bg-transparent hover:bg-[#ece8e1] active:bg-[#e6e1d9]",
      )}
    >
      <div className="px-1.5 py-1.5 sm:px-2.5 sm:py-2.5">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "min-w-0 w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
            creditCard
              ? "grid grid-cols-1 gap-1.5 sm:gap-3"
              : "grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 sm:gap-3",
          )}
        >
          {creditCard ? (
            <>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(120px,auto)] items-start gap-1.5 sm:gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  <InlineIcon icon={AccountIcon} iconClassName={selected ? "text-foreground" : "text-muted-foreground"} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] leading-[18px] font-medium tracking-[0.01em] text-foreground sm:type-h6">{account.name}</p>
                  </div>
                </div>

                <MoneyAmount
                  amount={account.balance}
                  currency={account.currency}
                  display="signed"
                  tone="negative"
                  showMinorUnits={showMinorUnits}
                  className="w-full justify-self-end text-[13px] leading-[18px] font-medium sm:text-[14px] sm:leading-5"
                />
              </div>

              {creditCardMetrics ? (
                <div className="pl-6 sm:pl-[28px]">
                  <ProgressTrack
                    value={creditCardMetrics.limit > 0 ? creditCardMetrics.available / creditCardMetrics.limit : 0}
                    className="-mt-0.5 h-0.5 sm:-mt-1"
                    trackClassName={selected ? "bg-foreground/14" : "bg-border/55"}
                    fillClassName={selected ? "bg-foreground/78" : "bg-foreground/62"}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-1.5 sm:gap-x-4">
                    <CreditCardMetric
                      label={t("metrics.available")}
                      amount={creditCardMetrics.available}
                      currency={account.currency}
                      showMinorUnits={showMinorUnits}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                <InlineIcon icon={AccountIcon} iconClassName={selected ? "text-foreground" : "text-muted-foreground"} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] leading-[18px] font-medium tracking-[0.01em] text-foreground sm:type-h6">{account.name}</p>
                  {detailLabel ? <p className="type-body-12 truncate">{detailLabel}</p> : null}
                </div>
              </div>

              <MoneyAmount
                amount={account.balance}
                currency={account.currency}
                display={debt ? "signed" : "absolute"}
                tone={debt ? "negative" : "default"}
                showMinorUnits={showMinorUnits}
                className="w-full justify-self-end text-[13px] leading-[18px] font-medium sm:text-[14px] sm:leading-5"
              />
            </>
          )}
        </button>
      </div>
      {showGoals ? (
        <div className="pb-1.5 sm:pb-2">
          <div className="mx-1.5 mb-1 h-px bg-foreground/6 sm:mx-2.5 sm:mb-1.5" />

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 px-1.5 pb-0.5 sm:gap-3 sm:px-2.5">
            <span className="pl-6 text-[12px] leading-[18px] text-muted-foreground/70 sm:pl-[28px] sm:text-[13px]">
              Free
            </span>
            <MoneyAmount
              amount={free}
              currency={account.currency}
              display="absolute"
              showMinorUnits
              tone={isOverfunded ? "negative" : "muted"}
              className="text-[12px] leading-[18px] font-medium sm:text-[13px]"
            />
          </div>

          {(allocations ?? []).map((allocation) => {
            const progressPercent =
              allocation.kind === "goal_targeted" && allocation.target_amount
                ? Math.min(100, Math.round((allocation.amount / allocation.target_amount) * 100))
                : null;

            return (
              <div key={allocation.id} className="group px-1.5 sm:px-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 py-0.5 sm:gap-3">
                  <div className="flex min-w-0 items-center gap-1.5 pl-6 sm:pl-[28px]">
                    {allocation.kind === "goal_targeted" ? (
                      <Target className="size-3 shrink-0 text-muted-foreground/50" />
                    ) : (
                      <span className="size-3 shrink-0" />
                    )}
                    <span className="truncate text-[12px] leading-[18px] font-medium text-foreground sm:text-[13px]">
                      {allocation.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-0.5">
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {onEditGoal ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-5 shrink-0 rounded-md bg-transparent text-muted-foreground/60 hover:bg-foreground/8 hover:text-foreground"
                          aria-label={`Edit ${allocation.name}`}
                          onClick={(e) => { e.stopPropagation(); onEditGoal(allocation); }}
                        >
                          <Pencil className="size-2.5" />
                        </Button>
                      ) : null}
                      {onDeleteGoal ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-5 shrink-0 rounded-md bg-transparent text-muted-foreground/60 hover:bg-foreground/8 hover:text-destructive"
                          aria-label={`Delete ${allocation.name}`}
                          onClick={(e) => { e.stopPropagation(); onDeleteGoal(allocation); }}
                        >
                          <Trash2 className="size-2.5" />
                        </Button>
                      ) : null}
                    </div>
                    <MoneyAmount
                      amount={allocation.amount}
                      currency={account.currency}
                      display="absolute"
                      showMinorUnits
                      className="text-[12px] leading-[18px] font-medium sm:text-[13px]"
                    />
                  </div>
                </div>

                {allocation.kind === "goal_targeted" && allocation.target_amount ? (
                  <div className="mt-0.5 space-y-0.5 pl-[36px] pb-0.5 sm:pl-[40px]">
                    <div className="h-0.5 w-full overflow-hidden rounded-full bg-foreground/8">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          progressPercent! >= 100 ? "bg-emerald-500" : "bg-foreground/30",
                        )}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] leading-none text-muted-foreground/60">
                      <span>{progressPercent}%</span>
                      <MoneyAmount
                        amount={allocation.target_amount}
                        currency={account.currency}
                        display="absolute"
                        showMinorUnits={false}
                        tone="muted"
                        className="text-[10px] leading-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {onAddGoal ? (
            <div className="px-1.5 pt-0.5 sm:px-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 rounded-md px-2 text-[11px] leading-none text-muted-foreground/60 hover:bg-foreground/6 hover:text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onAddGoal(); }}
              >
                <Plus className="size-3" />
                Add goal
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasActions && contextAnchor ? (
        <DropdownMenu open onOpenChange={(open) => (!open ? setContextAnchor(null) : null)}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-events-none fixed h-px w-px min-h-0 min-w-0 p-0 opacity-0"
                style={{ left: contextAnchor.x, top: contextAnchor.y }}
                aria-label={`${tr("common.actions.edit")} ${account.name}`}
              />
            }
          />
          <DropdownMenuContent className="w-40 rounded-xl p-1.5" side="right" align="start" sideOffset={6} alignOffset={-6}>
            {onAdjustBalance ? (
              <DropdownMenuItem
                className="rounded-lg px-2 py-2 text-[13px]"
                onClick={() => {
                  const rawValue = window.prompt(t("actions.adjustBalancePrompt"), String(account.balance));
                  if (rawValue === null) return;
                  const newBalance = parseFloat(rawValue);
                  if (!isNaN(newBalance)) onAdjustBalance(account, newBalance);
                }}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t("actions.adjustBalance")}
              </DropdownMenuItem>
            ) : null}
            {onEdit ? (
              <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEdit(account)}>
                <PencilLine className="h-4 w-4" />
                {t("actions.editWallet")}
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                className="rounded-lg px-2 py-2 text-[13px]"
                variant="destructive"
                onClick={() => onDelete(account)}
              >
                <Trash2 className="h-4 w-4" />
                {t("actions.deleteWallet")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function CreditCardMetric({
  label,
  amount,
  currency,
  showMinorUnits,
  tone = "muted",
}: {
  label: string;
  amount: number;
  currency: Account["currency"];
  showMinorUnits: boolean;
  tone?: "default" | "muted" | "negative";
}) {
  return (
    <div className="inline-flex min-w-0 items-baseline gap-1.5">
      <p className="shrink-0 text-[10px] leading-3.5 text-muted-foreground sm:text-[11px] sm:leading-4">{label}</p>
      <MoneyAmount
        amount={amount}
        currency={currency}
        display="absolute"
        tone={tone}
        showMinorUnits={showMinorUnits}
        className="w-auto text-[10px] leading-3.5 font-medium sm:text-[11px] sm:leading-4"
      />
    </div>
  );
}
