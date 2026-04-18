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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

export function TransactionFab({
  onSelect,
}: {
  onSelect: (kind: Transaction["kind"]) => void;
}) {
  const t = useTranslations("transactions");

  return (
    <div className="fixed right-6 bottom-24 sm:right-8 sm:bottom-8">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon"
                    className="size-14 rounded-full shadow-lg shadow-foreground/10"
                    aria-label={t("fab.tooltip")}
                  />
                }
              >
                <Plus />
              </DropdownMenuTrigger>
            }
          />
          <TooltipContent>{t("fab.tooltip")}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={12}
          className="w-80 rounded-3xl p-2"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[11px] tracking-[0.16em] uppercase">
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
    </div>
  );
}
