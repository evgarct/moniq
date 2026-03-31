"use client";

import { CheckCircle2, MoreHorizontal, Pause, Pencil, Play, SkipForward, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Transaction } from "@/types/finance";

export function TransactionRowActions({
  transaction,
  compact = false,
  variant = "default",
  onEditOccurrence,
  onEditSeries,
  onDeleteTransaction,
  onDeleteSeries,
  onMarkPaid,
  onSkipOccurrence,
  onToggleScheduleState,
}: {
  transaction: Transaction;
  compact?: boolean;
  variant?: "default" | "board";
  onEditOccurrence: (transaction: Transaction) => void;
  onEditSeries: (transaction: Transaction) => void;
  onDeleteTransaction: (transaction: Transaction) => void;
  onDeleteSeries: (transaction: Transaction) => void;
  onMarkPaid: (transaction: Transaction) => void;
  onSkipOccurrence: (transaction: Transaction) => void;
  onToggleScheduleState: (transaction: Transaction) => void;
}) {
  const t = useTranslations("transactions.actions");
  const isRecurring = Boolean(transaction.schedule_id && transaction.schedule);
  const canMarkPaid = transaction.status === "planned";
  const canSkip = transaction.status === "planned" && isRecurring;
  const canDeleteOneOff = !isRecurring;
  const schedulePaused = transaction.schedule?.state === "paused";

  return (
    <div className="flex items-center gap-2">
      {compact && canMarkPaid ? (
        <Button
          variant={variant === "board" ? "ghost" : "outline"}
          size="sm"
          className={variant === "board" ? "h-8 rounded-md border border-white/12 bg-white/4 px-2 text-[#d4e9e5] hover:bg-white/10 hover:text-white" : undefined}
          onClick={() => onMarkPaid(transaction)}
        >
          <CheckCircle2 data-icon="inline-start" />
          {t("markPaid")}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={variant === "board" ? "size-8 rounded-md text-[#86a9aa] hover:bg-white/8 hover:text-white" : undefined}
              aria-label={t("menu")}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuGroup>
            {!compact && canMarkPaid ? (
              <DropdownMenuItem onClick={() => onMarkPaid(transaction)}>
                <CheckCircle2 />
                {t("markPaid")}
              </DropdownMenuItem>
            ) : null}
            {canSkip ? (
              <DropdownMenuItem onClick={() => onSkipOccurrence(transaction)}>
                <SkipForward />
                {t("skipOccurrence")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => onEditOccurrence(transaction)}>
              <Pencil />
              {isRecurring ? t("editOccurrence") : t("edit")}
            </DropdownMenuItem>
            {isRecurring ? (
              <DropdownMenuItem onClick={() => onEditSeries(transaction)}>
                <Pencil />
                {t("editSeries")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>

          {isRecurring ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onToggleScheduleState(transaction)}>
                  {schedulePaused ? <Play /> : <Pause />}
                  {schedulePaused ? t("resumeSeries") : t("pauseSeries")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteSeries(transaction)}>
                  <Trash2 />
                  {t("deleteSeries")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}

          {canDeleteOneOff ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDeleteTransaction(transaction)}>
                <Trash2 />
                {t("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
