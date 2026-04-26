"use client";

import { ArrowLeftRight, BanknoteArrowDown, BanknoteArrowUp, Landmark, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/types/finance";

const quickAddOptions: Array<{
  kind: Transaction["kind"];
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { kind: "expense", icon: BanknoteArrowDown },
  { kind: "income", icon: BanknoteArrowUp },
  { kind: "transfer", icon: ArrowLeftRight },
  { kind: "debt_payment", icon: Landmark },
];

export function TransactionAddButton({
  onSelect,
  label,
  variant = "pill",
}: {
  onSelect: (kind: Transaction["kind"]) => void;
  label?: string;
  variant?: "pill" | "icon";
}) {
  const t = useTranslations("transactions");
  const displayLabel = label ?? t("fab.tooltip");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
              aria-label={displayLabel}
            />
          ) : (
            <Button
              variant="default"
              className="h-10 gap-2 rounded-full px-5 shadow-sm"
              aria-label={displayLabel}
            />
          )
        }
      >
        <Plus className="size-4" />
        {variant === "pill" ? <span className="font-medium">{displayLabel}</span> : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-80 rounded-3xl p-2"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.16em]">
            {t("fab.quickAdd")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {quickAddOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.kind}
                className="items-start gap-3 rounded-2xl px-3 py-3"
                onClick={() => onSelect(option.kind)}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground">{t(`kinds.${option.kind}`)}</span>
                  <span className="truncate text-xs text-muted-foreground">{t(`kindDescriptions.${option.kind}`)}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
