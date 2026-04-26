"use client";

import {
  ArrowLeftRight,
  BanknoteArrowDown,
  Landmark,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Account, Allocation, Category, Transaction, TransactionSchedule } from "@/types/finance";

import { RescheduleConfirmOverlay } from "./reschedule-confirm-overlay";
import { TransactionFormProvider, useTransactionFormContext } from "../form/context";
import { buildSubmitPayload } from "../form/submit";
import {
  AdjustmentSection,
  DebtPaymentSection,
  ExpenseSection,
  IncomeSection,
  InvestmentSection,
  RefundSection,
  SaveToGoalSection,
  SpendFromGoalSection,
  TransferSection,
} from "../form/sections";
import type { TransactionFormInputs, TransactionFormMode, TransactionFormSubmitPayload } from "../form/types";

// Re-export for consumers
export type { TransactionFormSubmitPayload };

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function getKindIcon(kind: Transaction["kind"]) {
  switch (kind) {
    case "income": return TrendingUp;
    case "transfer": return ArrowLeftRight;
    case "save_to_goal":
    case "spend_from_goal": return PiggyBank;
    case "debt_payment": return WalletCards;
    case "investment": return TrendingUp;
    case "refund": return RotateCcw;
    case "adjustment": return SlidersHorizontal;
    case "expense":
    default: return ReceiptText;
  }
}

// ─── Kind section map ─────────────────────────────────────────────────────────

const KIND_SECTIONS: Record<Transaction["kind"], React.ComponentType> = {
  expense: ExpenseSection,
  income: IncomeSection,
  transfer: TransferSection,
  save_to_goal: SaveToGoalSection,
  spend_from_goal: SpendFromGoalSection,
  debt_payment: DebtPaymentSection,
  investment: InvestmentSection,
  refund: RefundSection,
  adjustment: AdjustmentSection,
};

// ─── Inner form (has access to context) ──────────────────────────────────────

function TransactionFormInner() {
  const t = useTranslations("transactions.form");
  const kindsT = useTranslations("transactions.kinds");
  const {
    form,
    mode,
    kind,
    accounts,
    allocations,
    categories,
    transactions,
    onSubmit,
    onOpenChange,
  } = useTransactionFormContext();

  const { control } = useFormContext<TransactionFormInputs>();
  const Section = KIND_SECTIONS[kind];
  const formId = "transaction-form-sheet";
  const KindIcon = getKindIcon(kind);

  const handleSubmit = form.handleSubmit(async (values) => {
    const adjustmentMsg = t("validation.adjustmentNoDiff");

    if (values.kind === "adjustment" && mode === "add") {
      const account = accounts.find((a) => a.id === values.source_account_id);
      if (!account || values.adjustment_target_balance == null) return;
      const diff = values.adjustment_target_balance - account.balance;
      if (Math.abs(diff) < 0.001) {
        form.setError("adjustment_target_balance", { message: adjustmentMsg });
        return;
      }
    }

    const payload = buildSubmitPayload(
      values,
      mode,
      accounts,
      categories,
      allocations,
      t("adjustmentTitle"),
    );
    if (!payload) return;
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.message === "__reschedule_pending__") return;
      throw error;
    }
  });

  return (
    <form id={formId} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <SheetHeader className="gap-0 border-0 px-4 pt-4 pb-2 sm:px-5">
        <div className="relative flex justify-center">
          <Select
            value={kind}
            onValueChange={(v) => {
              form.setValue("kind", v as Transaction["kind"], { shouldValidate: false });
            }}
            disabled={mode !== "add"}
          >
            <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-2 py-0 text-center text-[0.95rem] font-medium capitalize shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
              <span className="inline-flex items-center gap-2 truncate">
                <KindIcon className="size-4 opacity-70" />
                <span>{kindsT(kind)}</span>
              </span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-auto min-w-[14rem]">
              <SelectItem value="expense">
                <span className="inline-flex items-center gap-2"><ReceiptText className="size-4 opacity-70" />{kindsT("expense")}</span>
              </SelectItem>
              <SelectItem value="income">
                <span className="inline-flex items-center gap-2"><TrendingUp className="size-4 opacity-70" />{kindsT("income")}</span>
              </SelectItem>
              <SelectItem value="transfer">
                <span className="inline-flex items-center gap-2"><ArrowLeftRight className="size-4 opacity-70" />{kindsT("transfer")}</span>
              </SelectItem>
              <SelectItem value="save_to_goal">
                <span className="inline-flex items-center gap-2"><PiggyBank className="size-4 opacity-70" />{kindsT("save_to_goal")}</span>
              </SelectItem>
              <SelectItem value="spend_from_goal">
                <span className="inline-flex items-center gap-2"><PiggyBank className="size-4 opacity-70" />{kindsT("spend_from_goal")}</span>
              </SelectItem>
              <SelectItem value="debt_payment">
                <span className="inline-flex items-center gap-2"><WalletCards className="size-4 opacity-70" />{kindsT("debt_payment")}</span>
              </SelectItem>
              <SelectItem value="investment">
                <span className="inline-flex items-center gap-2"><TrendingUp className="size-4 opacity-70" />{kindsT("investment")}</span>
              </SelectItem>
              <SelectItem value="refund">
                <span className="inline-flex items-center gap-2"><RotateCcw className="size-4 opacity-70" />{kindsT("refund")}</span>
              </SelectItem>
              <SelectItem value="adjustment">
                <span className="inline-flex items-center gap-2"><SlidersHorizontal className="size-4 opacity-70" />{kindsT("adjustment")}</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger
              render={
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-0 -translate-y-1/2"
                      aria-label={t("submit.cancel")}
                    />
                  }
                >
                  <X className="size-4" />
                </SheetClose>
              }
            />
            <TooltipContent>{t("submit.cancel")}</TooltipContent>
          </Tooltip>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
        <div className="space-y-6">
          <Section />

          <div className="flex justify-end pt-2">
            <Button type="submit" form={formId} variant="secondary" className="border-0 shadow-none">
              {mode === "add"
                ? t("submit.add")
                : mode === "edit-schedule"
                  ? t("submit.editSeries")
                  : t("submit.edit")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─── Public sheet component ───────────────────────────────────────────────────

export function TransactionFormSheet({
  open,
  mode,
  transaction,
  schedule,
  initialKind,
  initialDate,
  defaultSourceAccountId,
  accounts,
  allocations,
  categories,
  transactions = [],
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: TransactionFormMode;
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  initialDate?: string | null;
  defaultSourceAccountId?: string | null;
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  transactions?: Transaction[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void;
}) {
  const [pendingPayload, setPendingPayload] = useState<(TransactionFormSubmitPayload & { kind: "transaction" }) | null>(null);

  // Intercept submissions for scheduled occurrence edits where the date changed
  const wrappedOnSubmit = async (payload: TransactionFormSubmitPayload) => {
    if (
      payload.kind === "transaction" &&
      transaction?.schedule_id &&
      transaction.status === "planned" &&
      payload.values.occurred_at !== transaction.occurred_at
    ) {
      setPendingPayload(payload);
      // Throw so TransactionFormInner doesn't call onOpenChange(false)
      throw new Error("__reschedule_pending__");
    }
    await onSubmit(payload);
  };

  const handleOnlyThis = async () => {
    if (!pendingPayload) return;
    setPendingPayload(null);
    await onSubmit(pendingPayload);
    onOpenChange(false);
  };

  const handleAllFollowing = async () => {
    if (!pendingPayload || !transaction?.schedule_id) return;
    const payload: TransactionFormSubmitPayload = {
      ...pendingPayload,
      rescheduleFrom: {
        scheduleId: transaction.schedule_id,
        originalDate: transaction.occurred_at,
        newDate: pendingPayload.values.occurred_at,
      },
    };
    setPendingPayload(null);
    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { setPendingPayload(null); onOpenChange(next); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l-0 bg-background p-0 sm:top-6 sm:right-0 sm:h-[calc(100vh-3rem)] sm:w-[42rem] sm:max-w-none sm:border sm:border-border/30 sm:border-r-0 sm:shadow-[0_24px_72px_rgba(15,23,42,0.14)]"
      >
        <TransactionFormProvider
          open={open}
          mode={mode}
          transaction={transaction}
          schedule={schedule}
          initialKind={initialKind}
          initialDate={initialDate}
          defaultSourceAccountId={defaultSourceAccountId}
          accounts={accounts}
          allocations={allocations}
          categories={categories}
          transactions={transactions}
          onSubmit={wrappedOnSubmit}
          onOpenChange={onOpenChange}
        >
          <TransactionFormInner />
        </TransactionFormProvider>

        {pendingPayload && (
          <RescheduleConfirmOverlay
            onOnlyThis={handleOnlyThis}
            onAllFollowing={handleAllFollowing}
            onCancel={() => setPendingPayload(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
