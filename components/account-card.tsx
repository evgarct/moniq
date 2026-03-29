import { BanknoteArrowDown, CreditCard, Ellipsis, Landmark, PencilLine, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDebtAccount } from "@/features/accounts/lib/account-utils";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/finance";

export function AccountCard({
  account,
  selected = false,
  onSelect,
  editing = false,
  onEdit,
  onDelete,
  onAddSubgroup,
}: {
  account: Account;
  selected?: boolean;
  onSelect?: () => void;
  editing?: boolean;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const debt = isDebtAccount(account);
  const detailLabel =
    account.type === "debt"
      ? t(`walletTypes.${account.debt_kind ?? "debt"}` as const)
      : account.type === "credit_card"
        ? t("walletTypes.credit_card")
        : null;
  const AccountIcon =
    account.type === "saving"
      ? PiggyBank
      : account.type === "credit_card"
        ? CreditCard
        : account.type === "debt"
          ? Landmark
          : BanknoteArrowDown;
  const tooltip = detailLabel ?? account.name;

  return (
    <div
      title={tooltip}
      className={cn(
        "relative rounded-2xl border border-transparent transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-border bg-background shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-border)_60%,transparent)]"
          : "hover:border-border/75 hover:bg-muted/16 active:bg-muted/28",
        onSelect ? "focus-within:border-ring/70 focus-within:ring-3 focus-within:ring-ring/15" : "",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "grid min-w-0 w-full grid-cols-[minmax(0,1fr)_180px] items-center gap-4 rounded-2xl px-4 py-3.5 text-left outline-none",
          editing && (onEdit || onDelete || (account.type === "saving" && onAddSubgroup)) ? "pr-14" : "",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground">
            <AccountIcon className="size-[18px]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="type-h6 truncate pr-2">{account.name}</p>
            {detailLabel ? <p className="type-body-12 truncate">{detailLabel}</p> : null}
          </div>
        </div>

        <div className="w-[180px] text-right">
          <MoneyAmount
            amount={account.balance}
            currency={account.currency}
            display={debt ? "signed" : "absolute"}
            tone={debt ? "negative" : "default"}
            className="shrink-0 text-[14px] leading-6 font-normal text-foreground"
          />
        </div>
      </button>
      {editing && (onEdit || onDelete || (account.type === "saving" && onAddSubgroup)) ? (
        <div className="absolute top-1/2 right-2 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 rounded-full"
                    aria-label={`${tr("common.actions.edit")} ${account.name}`}
                  />
              }
            >
              <Ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40 rounded-xl p-1.5">
              {account.type === "saving" && onAddSubgroup ? (
                <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onAddSubgroup(account)}>
                  <Plus className="h-4 w-4" />
                  {t("actions.addGoal")}
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
        </div>
      ) : null}
    </div>
  );
}
