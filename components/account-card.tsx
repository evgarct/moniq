import { BanknoteArrowDown, CreditCard, Ellipsis, Landmark, PencilLine, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountAmount } from "@/components/account-amount";
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
        "relative rounded-xl border transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-border bg-accent/55 shadow-sm"
          : "border-transparent hover:border-border/60 hover:bg-card/70 active:border-border/70 active:bg-accent/35",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "grid min-w-0 w-full grid-cols-[minmax(0,1fr)_168px] items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
          editing && (onEdit || onDelete || (account.type === "saving" && onAddSubgroup)) ? "pr-12" : "",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <AccountIcon
            className={cn("size-[18px] shrink-0", selected ? "text-foreground" : "text-muted-foreground")}
            strokeWidth={1.75}
          />
          <div className="min-w-0">
            <p className="type-h6 truncate">{account.name}</p>
            {detailLabel ? <p className="type-body-12 truncate">{detailLabel}</p> : null}
          </div>
        </div>

        <AccountAmount
          amount={account.balance}
          currency={account.currency}
          display={debt ? "signed" : "absolute"}
          tone={debt ? "negative" : "default"}
          className="w-[168px]"
          numberClassName="text-[14px] leading-5 font-medium"
        />
      </button>
      {editing && (onEdit || onDelete || (account.type === "saving" && onAddSubgroup)) ? (
        <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
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
