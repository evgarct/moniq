"use client";

import {
  ArrowLeftRight,
  type LucideIcon,
  ReceiptText,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Account, Category, Transaction, TransactionSchedule, WalletAllocation } from "@/types/finance";

import { RescheduleConfirmOverlay } from "./reschedule-confirm-overlay";
import { TransactionFormProvider, useTransactionFormContext } from "../form/context";
import { buildSubmitPayload } from "../form/submit";
import {
  DebtPaymentSection,
  ExpenseSection,
  IncomeSection,
  TransferSection,
} from "../form/sections";
import type { TransactionFormInputs, TransactionFormMode, TransactionFormSubmitPayload } from "../form/types";

// Re-export for consumers
export type { TransactionFormSubmitPayload };

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const KIND_ICONS: Record<Transaction["kind"], LucideIcon> = {
  expense: ReceiptText,
  income: TrendingUp,
  transfer: ArrowLeftRight,
  debt_payment: WalletCards,
};

// ─── Kind section map ─────────────────────────────────────────────────────────

const KIND_SECTIONS: Record<Transaction["kind"], React.ComponentType> = {
  expense: ExpenseSection,
  income: IncomeSection,
  transfer: TransferSection,
  debt_payment: DebtPaymentSection,
};

function getFormTitle(
  t: (key: "addTitle" | "editSeriesTitle" | "editTitle") => string,
  mode: TransactionFormMode,
) {
  if (mode === "add") return t("addTitle");
  if (mode === "edit-schedule") return t("editSeriesTitle");
  return t("editTitle");
}

function TransactionKindOption({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="truncate">{children}</span>
    </span>
  );
}

// ─── Inner form (has access to context) ──────────────────────────────────────

function TransactionFormInner() {
  const t = useTranslations("transactions.form");
  const kindsT = useTranslations("transactions.kinds");
  const {
    form,
    mode,
    kind,
    accounts,
    categories,
    onSubmit,
    onOpenChange,
  } = useTransactionFormContext();

  const { control: _control } = useFormContext<TransactionFormInputs>();
  void _control;
  const Section = KIND_SECTIONS[kind];
  const formId = "transaction-form-sheet";
  const KindIcon = KIND_ICONS[kind];
  const title = getFormTitle(t, mode);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = buildSubmitPayload(values, mode, accounts, categories);
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
      <SheetHeader className="gap-0 border-b border-border/60 bg-card px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <SheetTitle className="type-h5 truncate">{title}</SheetTitle>
            <SheetDescription className="type-body-12 mt-1 line-clamp-2 text-muted-foreground">
              {t("description")}
            </SheetDescription>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground"
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

        <div className="mt-4 grid gap-1.5">
          <span className="type-body-12 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("fields.kind")}
          </span>
          <Select
            value={kind}
            onValueChange={(v) => {
              form.setValue("kind", v as Transaction["kind"], { shouldValidate: false });
            }}
            disabled={mode !== "add"}
          >
            <SelectTrigger
              autoFocus
              className={cn(
                "h-11 w-full justify-between rounded-control border border-border/70 bg-background px-3 text-left shadow-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                mode !== "add" && "opacity-100",
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2 truncate">
                <KindIcon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>{kindsT(kind)}</span>
              </span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-auto min-w-[14rem]">
              <SelectGroup>
                <SelectItem value="expense">
                  <TransactionKindOption icon={ReceiptText}>{kindsT("expense")}</TransactionKindOption>
                </SelectItem>
                <SelectItem value="income">
                  <TransactionKindOption icon={TrendingUp}>{kindsT("income")}</TransactionKindOption>
                </SelectItem>
                <SelectItem value="transfer">
                  <TransactionKindOption icon={ArrowLeftRight}>{kindsT("transfer")}</TransactionKindOption>
                </SelectItem>
                <SelectItem value="debt_payment">
                  <TransactionKindOption icon={WalletCards}>{kindsT("debt_payment")}</TransactionKindOption>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-5">
          <Section />
        </div>
      </div>

      <div className="border-t border-border/60 bg-card px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-12 text-muted-foreground">
            {t("footer.singleSummary")}
          </p>
          <Button type="submit" form={formId} className="w-full sm:w-auto">
            {mode === "add"
              ? t("submit.add")
              : mode === "edit-schedule"
                ? t("submit.editSeries")
                : t("submit.edit")}
          </Button>
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
  categories,
  transactions = [],
  allocations = [],
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
  categories: Category[];
  transactions?: Transaction[];
  allocations?: WalletAllocation[];
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
        className="w-full gap-0 border-l-0 bg-background p-0 sm:top-6 sm:right-0 sm:h-[calc(100vh-3rem)] sm:w-[42rem] sm:max-w-none sm:border sm:border-border/30 sm:border-r-0"
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
          categories={categories}
          transactions={transactions}
          allocations={allocations}
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
