"use client";

import { ArrowLeft, Check, ChevronDown, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  getCashAccounts,
  getCreditCardAccounts,
  getDebtAccounts,
  getSavingAccounts,
} from "@/lib/finance-selectors";
import { cn } from "@/lib/utils";
import type { ProjectedBalanceSelection } from "@/features/reports/lib/projected-balance-url";
import type { Account } from "@/types/finance";

function accountIcon(account: Account) {
  if (account.type === "saving") return PiggyBank;
  if (account.type === "credit_card") return CreditCard;
  if (account.type === "debt") return Landmark;
  return Wallet;
}

function PickerRows({
  accounts,
  selection,
  onSelectionChange,
  compact = false,
}: {
  accounts: Account[];
  selection: ProjectedBalanceSelection;
  onSelectionChange: (selection: ProjectedBalanceSelection) => void;
  compact?: boolean;
}) {
  const t = useTranslations("reports.projectedBalance.accountPicker");
  const accountGroupsT = useTranslations("accounts.groups");
  const selected = new Set(selection.accountIds);
  const allSelected = accounts.length > 0 && selection.accountIds.length === accounts.length;
  const groups = [
    { id: "cash", label: accountGroupsT("cash"), accounts: getCashAccounts(accounts) },
    { id: "saving", label: accountGroupsT("savings"), accounts: getSavingAccounts(accounts) },
    { id: "credit-card", label: accountGroupsT("creditCards"), accounts: getCreditCardAccounts(accounts) },
    { id: "debt", label: accountGroupsT("debt"), accounts: getDebtAccounts(accounts) },
  ].filter((group) => group.accounts.length);

  function toggleAccount(accountId: string, checked: boolean) {
    const nextIds = checked
      ? [...selection.accountIds, accountId]
      : selection.accountIds.filter((id) => id !== accountId);

    if (nextIds.length) {
      onSelectionChange({
        ...selection,
        accountIds: Array.from(new Set(nextIds)),
      });
    }
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      <label
        className={cn(
          "flex min-h-11 cursor-pointer items-center justify-between gap-4 px-3",
          compact && "rounded-[var(--radius-control)] hover:bg-secondary/50",
        )}
      >
        <span className="type-body-14">{t("merged")}</span>
        <Switch
          checked={selection.merged}
          onCheckedChange={(merged) => onSelectionChange({ ...selection, merged })}
        />
      </label>

      <button
        type="button"
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-4 px-3 text-left",
          compact && "rounded-[var(--radius-control)] hover:bg-secondary/50",
        )}
        onClick={() =>
          onSelectionChange({
            ...selection,
            accountIds: accounts.map((account) => account.id),
          })
        }
      >
        <span className="type-body-14">{t("all")}</span>
        {allSelected ? <Check className="size-4" aria-hidden /> : null}
      </button>

      {groups.map((group) => (
        <section key={group.id}>
          <p className="type-body-12 bg-secondary/70 px-3 py-1.5 font-medium text-foreground">
            {group.label}
          </p>
          <div className="flex flex-col">
            {group.accounts.map((account) => {
              const Icon = accountIcon(account);
              const checkboxId = `projected-balance-account-${account.id}-${compact ? "menu" : "sheet"}`;
              const checked = selected.has(account.id);

              return (
                <label
                  key={account.id}
                  htmlFor={checkboxId}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 border-b border-border/50 px-3 last:border-b-0",
                    compact && "min-h-11 rounded-[var(--radius-control)] border-b-0 hover:bg-secondary/50",
                  )}
                >
                  <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="type-body-14 min-w-0 flex-1 truncate">{account.name}</span>
                  <span className="type-body-12 text-muted-foreground">{account.currency}</span>
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={(nextChecked) => toggleAccount(account.id, nextChecked)}
                  />
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ProjectedBalanceAccountPicker({
  accounts,
  selection,
  onSelectionChange,
  initialOpen = false,
}: {
  accounts: Account[];
  selection: ProjectedBalanceSelection;
  onSelectionChange: (selection: ProjectedBalanceSelection) => void;
  initialOpen?: boolean;
}) {
  const t = useTranslations("reports.projectedBalance.accountPicker");
  const commonT = useTranslations("common.actions");
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectionLabel = selection.accountIds.length === accounts.length
    ? t("all")
    : t("selected", { count: selection.accountIds.length });

  function resetSelection() {
    onSelectionChange({
      accountIds: accounts.map((account) => account.id),
      merged: true,
    });
  }

  return (
    <>
      <div className="hidden lg:block">
        <Popover defaultOpen={initialOpen}>
          <PopoverTrigger
            render={
              <Button variant="ghost" className="bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground" />
            }
          >
            <Wallet data-icon="inline-start" />
            {selectionLabel}
            <ChevronDown data-icon="inline-end" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-1">
            <PickerRows
              accounts={accounts}
              selection={selection}
              onSelectionChange={onSelectionChange}
              compact
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="ghost"
        className="bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Wallet data-icon="inline-start" />
        {selectionLabel}
        <ChevronDown data-icon="inline-end" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="fullscreen" className="gap-0 p-0 lg:hidden" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <header className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-border/60 px-2">
            <Button variant="ghost" className="justify-self-start" onClick={() => setMobileOpen(false)}>
              <ArrowLeft data-icon="inline-start" />
              {commonT("back")}
            </Button>
            <h2 className="type-h6">{t("title")}</h2>
            <Button variant="ghost" className="justify-self-end" onClick={resetSelection}>
              {t("reset")}
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <PickerRows
              accounts={accounts}
              selection={selection}
              onSelectionChange={onSelectionChange}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
