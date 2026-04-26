"use client";

import {
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Landmark,
  PiggyBank,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
  { kind: "save_to_goal", icon: PiggyBank },
  { kind: "spend_from_goal", icon: PiggyBank },
  { kind: "debt_payment", icon: Landmark },
  { kind: "investment", icon: TrendingUp },
  { kind: "refund", icon: RotateCcw },
  { kind: "adjustment", icon: SlidersHorizontal },
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
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-52 rounded-[var(--radius-floating)] p-1"
      >
        <DropdownMenuGroup>
          {quickAddOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.kind}
                className="gap-2.5 rounded-[var(--radius-control)] px-3 py-2"
                onClick={() => onSelect(option.kind)}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="font-medium">{t(`kinds.${option.kind}`)}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
