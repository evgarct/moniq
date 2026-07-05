import { useRef } from "react";
import { BanknoteArrowDown, CreditCard, Landmark, Pencil, PencilLine, PiggyBank, PlusCircle, SlidersHorizontal, Target, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import { InlineIcon } from "@/components/ui/inline-icon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getCreditCardMetrics, isCreditCardAccount, isDebtAccount } from "@/features/accounts/lib/account-utils";
import { cn } from "@/lib/utils";
import type { Account, WalletAllocation } from "@/types/finance";

export function AccountRow({
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
  const hasActions = Boolean(onEdit || onDelete || onAdjustBalance || onAddGoal);
  const suppressClickUntil = useRef(0);
  const showGoals = account.type === "saving" && allocations !== undefined;
  const accountAllocations = allocations ?? [];
  const totalAllocated = showGoals ? accountAllocations.reduce((sum, a) => sum + a.amount, 0) : 0;
  const free = account.balance - totalAllocated;
  const isOverfunded = free < -0.001;

  return (
    <div
      className={cn(
        "relative rounded-sm transition-[background-color,color]",
        selected ? "bg-secondary text-foreground" : "bg-transparent",
      )}
    >
      <ContextMenu
        disabled={!hasActions}
        onOpenChange={(open) => {
          if (open) suppressClickUntil.current = Date.now() + 700;
        }}
      >
        <ContextMenuTrigger render={<button
          type="button"
          onClick={() => {
            if (Date.now() >= suppressClickUntil.current) onSelect?.();
          }}
          className={cn(
            "min-w-0 w-full rounded-sm px-1.5 py-1.5 text-left outline-none transition-[background-color] hover:bg-secondary/70 active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/25 sm:px-2.5 sm:py-2.5",
            selected && "hover:bg-secondary",
            creditCard
              ? "grid grid-cols-1 gap-1.5 sm:gap-3"
              : "grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 sm:gap-3",
          )}
        />}>
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
        </ContextMenuTrigger>
        <AccountContextActions
          account={account}
          onAddGoal={onAddGoal}
          onAdjustBalance={onAdjustBalance}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </ContextMenu>
      {showGoals ? (
        <div className="px-1.5 pb-2.5 sm:px-2.5 sm:pb-3">
          <div className="mb-2.5 h-px bg-foreground/6 sm:mb-3" />

          <div className="space-y-2.5 pl-6 sm:pl-[28px]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-start gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="type-body-12 text-muted-foreground">{t("metrics.free")}</p>
              </div>
              <div className="grid justify-items-end">
                <MoneyAmount
                  amount={free}
                  currency={account.currency}
                  showMinorUnits={showMinorUnits}
                  tone={isOverfunded ? "negative" : "muted"}
                  className="text-[13px] leading-[18px] font-medium tabular-nums"
                />
              </div>
            </div>

            {accountAllocations.length ? (
              <div className="space-y-1.5">
                {accountAllocations.map((allocation) => {
                  const progressPercent =
                    allocation.kind === "goal_targeted" && allocation.target_amount
                      ? Math.min(100, Math.round((allocation.amount / allocation.target_amount) * 100))
                      : null;

                  return (
                    <ContextMenu key={allocation.id} disabled={!onEditGoal && !onDeleteGoal}>
                      <ContextMenuTrigger
                        render={<div className="group rounded-[var(--radius-tight)] py-1 transition-colors hover:bg-secondary/70" />}
                      >
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)] items-center gap-2 sm:gap-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {allocation.kind === "goal_targeted" ? (
                            <Target className="size-3 shrink-0 text-muted-foreground/50" />
                          ) : (
                            <span className="size-3 shrink-0" />
                          )}
                          <span className="truncate text-[12px] leading-[18px] font-medium text-foreground sm:text-[13px]">
                            {allocation.name}
                          </span>
                        </div>

                        <div className="flex items-center justify-end">
                          <MoneyAmount
                            amount={allocation.amount}
                            currency={account.currency}
                            display="absolute"
                            showMinorUnits={showMinorUnits}
                            className="text-[12px] leading-[18px] font-medium tabular-nums sm:text-[13px]"
                          />
                        </div>
                      </div>

                      {allocation.kind === "goal_targeted" && allocation.target_amount ? (
                        <div className="mt-1.5 space-y-1 pl-[18px] pb-1">
                          <div className="h-0.5 w-full overflow-hidden rounded-full bg-foreground/8">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width,background-color]",
                                progressPercent! >= 100 ? "bg-foreground/55" : "bg-foreground/30",
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
                      </ContextMenuTrigger>
                      <AllocationContextActions
                        allocation={allocation}
                        onEditGoal={onEditGoal}
                        onDeleteGoal={onDeleteGoal}
                      />
                    </ContextMenu>
                  );
                })}
              </div>
            ) : null}

          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountContextActions({
  account,
  onAddGoal,
  onAdjustBalance,
  onEdit,
  onDelete,
}: {
  account: Account;
  onAddGoal?: () => void;
  onAdjustBalance?: (account: Account, newBalance: number) => void;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
}) {
  const t = useTranslations("accounts");
  return (
    <ContextMenuContent className="w-48 rounded-[var(--radius-floating)] p-1.5">
      {onAddGoal ? <ContextMenuItem onClick={onAddGoal}><PlusCircle />{t("actions.addGoal")}</ContextMenuItem> : null}
      {onAdjustBalance ? (
        <ContextMenuItem onClick={() => {
          const rawValue = window.prompt(t("actions.adjustBalancePrompt"), String(account.balance));
          if (rawValue === null) return;
          const newBalance = Number(rawValue);
          if (Number.isFinite(newBalance)) onAdjustBalance(account, newBalance);
        }}>
          <SlidersHorizontal />{t("actions.adjustBalance")}
        </ContextMenuItem>
      ) : null}
      {onEdit ? <ContextMenuItem onClick={() => onEdit(account)}><PencilLine />{t("actions.editWallet")}</ContextMenuItem> : null}
      {onDelete ? <ContextMenuItem variant="destructive" onClick={() => onDelete(account)}><Trash2 />{t("actions.deleteWallet")}</ContextMenuItem> : null}
    </ContextMenuContent>
  );
}

function AllocationContextActions({
  allocation,
  onEditGoal,
  onDeleteGoal,
}: {
  allocation: WalletAllocation;
  onEditGoal?: (allocation: WalletAllocation) => void;
  onDeleteGoal?: (allocation: WalletAllocation) => void;
}) {
  const t = useTranslations("accounts");
  return (
    <ContextMenuContent className="w-48 rounded-[var(--radius-floating)] p-1.5">
      {onEditGoal ? <ContextMenuItem onClick={() => onEditGoal(allocation)}><Pencil />{t("actions.editGoal", { name: allocation.name })}</ContextMenuItem> : null}
      {onDeleteGoal ? <ContextMenuItem variant="destructive" onClick={() => onDeleteGoal(allocation)}><Trash2 />{t("actions.deleteGoal", { name: allocation.name })}</ContextMenuItem> : null}
    </ContextMenuContent>
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
