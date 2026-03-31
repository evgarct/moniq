"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { CheckCircle2, CircleAlert, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, type FieldError, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Account, Allocation, Category, Transaction, TransactionSchedule } from "@/types/finance";
import type { TransactionEntryBatchInput, TransactionEntryInput, TransactionInput, TransactionScheduleInput } from "@/types/finance-schemas";

type BatchKind = "income" | "expense" | "save_to_goal" | "spend_from_goal";

type TransactionLineItemInput = {
  category_id: string | null;
  allocation_id: string | null;
  amount: number | null;
};

type TransactionFormInputs = {
  title: string;
  note: string;
  occurred_at: string;
  status: "planned" | "paid";
  kind: Transaction["kind"];
  amount: number;
  destination_amount: number | null;
  fx_rate: number | null;
  principal_amount: number | null;
  interest_amount: number | null;
  extra_principal_amount: number | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  allocation_id: string | null;
  is_recurring: boolean;
  recurrence_frequency: TransactionSchedule["frequency"];
  recurrence_until: string | null;
  line_items: TransactionLineItemInput[];
};

export type TransactionFormSubmitPayload =
  | { kind: "entry"; values: TransactionEntryInput }
  | { kind: "entry-batch"; values: TransactionEntryBatchInput }
  | { kind: "transaction"; values: TransactionInput }
  | { kind: "schedule"; values: TransactionScheduleInput };

function isMoveKind(kind: Transaction["kind"]) {
  return kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal";
}

function supportsBatchItems(kind: Transaction["kind"]): kind is BatchKind {
  return kind === "income" || kind === "expense" || kind === "save_to_goal" || kind === "spend_from_goal";
}

function createEmptyLineItem(): TransactionLineItemInput {
  return {
    category_id: null,
    allocation_id: null,
    amount: null,
  };
}

function buildTransactionFormSchema(
  t: ReturnType<typeof useTranslations<"transactions.form">>,
  mode: "add" | "edit-transaction" | "edit-schedule",
) {
  const opaqueIdSchema = z.string().trim().min(1).nullable();
  const lineItemSchema = z.object({
    category_id: opaqueIdSchema,
    allocation_id: opaqueIdSchema,
    amount: z.number().positive(t("validation.amountPositive")).nullable(),
  });

  return z
    .object({
      title: z.string().trim(),
      note: z.string().trim().max(500, t("validation.noteMax")),
      occurred_at: z.string().trim().min(1, t("validation.dateRequired")),
      status: z.enum(["planned", "paid"]),
      kind: z.enum(["income", "expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"]),
      amount: z.number().positive(t("validation.amountPositive")),
      destination_amount: z.number().positive(t("validation.destinationAmountPositive")).nullable(),
      fx_rate: z.number().positive(t("validation.fxRatePositive")).nullable(),
      principal_amount: z.number().min(0, t("validation.principalMin")).nullable(),
      interest_amount: z.number().min(0, t("validation.interestMin")).nullable(),
      extra_principal_amount: z.number().min(0, t("validation.extraMin")).nullable(),
      category_id: opaqueIdSchema,
      source_account_id: opaqueIdSchema,
      destination_account_id: opaqueIdSchema,
      allocation_id: opaqueIdSchema,
      is_recurring: z.boolean(),
      recurrence_frequency: z.enum(["daily", "weekly", "monthly"]),
      recurrence_until: z.string().trim().nullable(),
      line_items: z.array(lineItemSchema),
    })
    .superRefine((values, ctx) => {
      const batchMode = mode === "add" && supportsBatchItems(values.kind);
      const requireSource =
        values.kind === "expense" ||
        values.kind === "transfer" ||
        values.kind === "save_to_goal" ||
        values.kind === "spend_from_goal" ||
        values.kind === "debt_payment";
      const requireDestination =
        values.kind === "income" ||
        values.kind === "transfer" ||
        values.kind === "save_to_goal" ||
        values.kind === "spend_from_goal" ||
        values.kind === "debt_payment";

      if (requireSource && !values.source_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_account_id"], message: t("validation.sourceRequired") });
      }

      if (requireDestination && !values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: t("validation.destinationRequired") });
      }

      if (values.kind === "transfer" && values.category_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: t("validation.transferNoCategory") });
      }

      if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !values.allocation_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocation_id"], message: t("validation.goalRequired") });
      }

      if (values.source_account_id && values.destination_account_id && values.source_account_id === values.destination_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination_account_id"],
          message: t("validation.differentDestination"),
        });
      }

      if (batchMode) {
        if (!values.line_items.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items"], message: t("validation.lineItemsRequired") });
        }

        values.line_items.forEach((item, index) => {
          if (!item.amount) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["line_items", index, "amount"],
              message: t("validation.amountPositive"),
            });
          }

          if ((values.kind === "income" || values.kind === "expense") && !item.category_id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["line_items", index, "category_id"],
              message: t("validation.categoryRequired"),
            });
          }

          if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !item.allocation_id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["line_items", index, "allocation_id"],
              message: t("validation.goalRequired"),
            });
          }
        });
      }

      const requireCategory = !batchMode && (values.kind === "income" || values.kind === "expense");

      if (requireCategory && !values.category_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: t("validation.categoryRequired") });
      }

      if (values.kind === "debt_payment") {
        const principal = values.principal_amount ?? 0;
        const interest = values.interest_amount ?? 0;
        const extra = values.extra_principal_amount ?? 0;
        const breakdownTotal = principal + interest + extra;

        if (breakdownTotal <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["principal_amount"], message: t("validation.debtBreakdownRequired") });
        }

        if (Math.abs(breakdownTotal - values.amount) > 0.01) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: t("validation.debtBreakdownMismatch") });
        }
      }

      const requiresDestinationAmount = values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal";
      if (!batchMode && requiresDestinationAmount && !values.destination_amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination_amount"],
          message: t("validation.destinationAmountRequired"),
        });
      }

      if (!batchMode && !values.amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: t("validation.amountPositive") });
      }

      if (values.is_recurring && values.status !== "planned") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: t("validation.recurringMustBePlanned"),
        });
      }

      if (values.is_recurring && values.recurrence_until && values.recurrence_until < values.occurred_at) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recurrence_until"],
          message: t("validation.recurrenceUntilBeforeStart"),
        });
      }
    });
}

function normalizeTransactionPayload(values: TransactionFormInputs): TransactionInput {
  return {
    title: values.title.trim(),
    note: values.note.trim() ? values.note.trim() : null,
    occurred_at: values.occurred_at,
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: isMoveKind(values.kind) ? values.destination_amount ?? values.amount : null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.kind === "debt_payment" ? values.principal_amount ?? 0 : null,
    interest_amount: values.kind === "debt_payment" ? values.interest_amount ?? 0 : null,
    extra_principal_amount: values.kind === "debt_payment" ? values.extra_principal_amount ?? 0 : null,
    category_id: isMoveKind(values.kind) ? null : values.category_id ?? null,
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
    allocation_id: values.kind === "save_to_goal" || values.kind === "spend_from_goal" ? values.allocation_id ?? null : null,
  };
}

function buildDefaultValues({
  transaction,
  schedule,
  initialKind,
  mode,
}: {
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  mode: "add" | "edit-transaction" | "edit-schedule";
}): TransactionFormInputs {
  const currentKind = schedule?.kind ?? transaction?.kind ?? initialKind ?? "expense";

  return {
    title: schedule?.title ?? transaction?.title ?? "",
    note: schedule?.note ?? transaction?.note ?? "",
    occurred_at: schedule?.start_date ?? transaction?.occurred_at ?? new Date().toISOString().slice(0, 10),
    status: mode === "edit-schedule" ? "planned" : transaction?.status === "paid" ? "paid" : "planned",
    kind: currentKind,
    amount: schedule?.amount ?? transaction?.amount ?? 0,
    destination_amount: schedule?.destination_amount ?? transaction?.destination_amount ?? null,
    fx_rate: schedule?.fx_rate ?? transaction?.fx_rate ?? null,
    principal_amount: schedule?.principal_amount ?? transaction?.principal_amount ?? null,
    interest_amount: schedule?.interest_amount ?? transaction?.interest_amount ?? null,
    extra_principal_amount: schedule?.extra_principal_amount ?? transaction?.extra_principal_amount ?? null,
    category_id: schedule?.category_id ?? transaction?.category_id ?? null,
    source_account_id: schedule?.source_account_id ?? transaction?.source_account_id ?? null,
    destination_account_id: schedule?.destination_account_id ?? transaction?.destination_account_id ?? null,
    allocation_id: schedule?.allocation_id ?? transaction?.allocation_id ?? null,
    is_recurring: mode === "edit-schedule",
    recurrence_frequency: schedule?.frequency ?? "monthly",
    recurrence_until: schedule?.until_date ?? null,
    line_items:
      mode === "add" && supportsBatchItems(currentKind)
        ? [createEmptyLineItem()]
        : [
            {
              category_id: schedule?.category_id ?? transaction?.category_id ?? null,
              allocation_id: schedule?.allocation_id ?? transaction?.allocation_id ?? null,
              amount: schedule?.amount ?? transaction?.amount ?? null,
            },
          ],
  };
}

function NumericField({
  id,
  label,
  value,
  onChange,
  hideLabel = false,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className={cn("text-sm font-medium", hideLabel && "sr-only")} htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      />
    </div>
  );
}

function FieldMessage({ error }: { error?: FieldError }) {
  if (!error?.message) {
    return null;
  }

  return <p className="text-sm text-destructive">{error.message}</p>;
}

function inferBatchItemTitle(
  item: TransactionLineItemInput,
  kind: BatchKind,
  categories: Category[],
  allocations: Allocation[],
) {
  if (kind === "income" || kind === "expense") {
    return categories.find((category) => category.id === item.category_id)?.name ?? "";
  }

  return allocations.find((allocation) => allocation.id === item.allocation_id)?.name ?? "";
}

function inferSingleTitle(values: TransactionFormInputs, accounts: Account[], categories: Category[], allocations: Allocation[]) {
  if (values.kind === "income" || values.kind === "expense") {
    return categories.find((category) => category.id === values.category_id)?.name ?? values.title.trim();
  }

  if (values.kind === "save_to_goal" || values.kind === "spend_from_goal") {
    return allocations.find((allocation) => allocation.id === values.allocation_id)?.name ?? values.title.trim();
  }

  if (values.kind === "transfer") {
    const source = accounts.find((account) => account.id === values.source_account_id)?.name;
    const destination = accounts.find((account) => account.id === values.destination_account_id)?.name;
    return source && destination ? `${source} → ${destination}` : values.title.trim();
  }

  if (values.kind === "debt_payment") {
    return accounts.find((account) => account.id === values.destination_account_id)?.name ?? values.title.trim();
  }

  return values.title.trim();
}

function getStatusTone(status: TransactionFormInputs["status"], occurredAt: string) {
  if (status === "paid") {
    return "paid";
  }

  return isBefore(startOfDay(parseISO(occurredAt)), startOfDay(new Date())) ? "overdue" : "planned";
}

export function TransactionFormSheet({
  open,
  mode,
  transaction,
  schedule,
  initialKind,
  accounts,
  allocations,
  categories,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit-transaction" | "edit-schedule";
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void;
}) {
  const t = useTranslations("transactions.form");
  const kindsT = useTranslations("transactions.kinds");
  const transactionFormSchema = useMemo(() => buildTransactionFormSchema(t, mode), [mode, t]);

  const form = useForm<TransactionFormInputs>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: buildDefaultValues({ transaction, schedule, initialKind, mode }),
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  useEffect(() => {
    form.reset(buildDefaultValues({ transaction, schedule, initialKind, mode }));
  }, [form, initialKind, mode, open, schedule, transaction]);

  const kind = useWatch({ control: form.control, name: "kind" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate" });
  const occurredAt = useWatch({ control: form.control, name: "occurred_at" });
  const status = useWatch({ control: form.control, name: "status" });
  const sourceAccountId = useWatch({ control: form.control, name: "source_account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });
  const isRecurring = useWatch({ control: form.control, name: "is_recurring" });
  const recurrenceUntil = useWatch({ control: form.control, name: "recurrence_until" });
  const lineItems = useWatch({ control: form.control, name: "line_items" });
  const supportsBatch = mode === "add" && supportsBatchItems(kind);

  const selectedType = kind === "income" ? "income" : "expense";
  const categoryOptions = categories.filter((category) => category.type === selectedType);
  const goalOptions = allocations.filter((allocation) => {
    if (kind === "save_to_goal") {
      return allocation.account_id === destinationAccountId;
    }

    if (kind === "spend_from_goal") {
      return allocation.account_id === sourceAccountId;
    }

    return true;
  });

  useEffect(() => {
    if (supportsBatch && !fields.length) {
      replace([createEmptyLineItem()]);
    }
  }, [fields.length, replace, supportsBatch]);

  useEffect(() => {
    if (isMoveKind(kind) && fxRate && amount) {
      form.setValue("destination_amount", Number((amount * fxRate).toFixed(2)), {
        shouldValidate: true,
      });
    }
  }, [amount, form, fxRate, kind]);

  const totalAmount = (lineItems ?? []).reduce((sum, item) => sum + (item?.amount ?? 0), 0);
  const statusTone = getStatusTone(status, occurredAt);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (supportsBatchItems(values.kind) && mode === "add") {
      const batchKind = values.kind;
      const entries: TransactionEntryInput[] = values.line_items.map((item) => ({
        ...normalizeTransactionPayload({
          ...values,
          title: inferBatchItemTitle(item, batchKind, categories, allocations),
          amount: item.amount ?? 0,
          category_id: batchKind === "income" || batchKind === "expense" ? item.category_id : null,
          allocation_id: batchKind === "save_to_goal" || batchKind === "spend_from_goal" ? item.allocation_id : null,
          status: values.is_recurring ? "planned" : values.status,
        }),
        recurrence: values.is_recurring
          ? {
              frequency: values.recurrence_frequency,
              until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
            }
          : null,
      }));

      await onSubmit({
        kind: "entry-batch",
        values: {
          entries,
        },
      });

      onOpenChange(false);
      return;
    }

    const transactionPayload = normalizeTransactionPayload({
      ...values,
      title: inferSingleTitle(values, accounts, categories, allocations),
      status: values.is_recurring ? "planned" : values.status,
    });

    if (mode === "edit-schedule") {
      await onSubmit({
        kind: "schedule",
        values: {
          ...transactionPayload,
          recurrence: {
            frequency: values.recurrence_frequency,
            until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
          },
        },
      });
    } else if (mode === "edit-transaction") {
      await onSubmit({
        kind: "transaction",
        values: transactionPayload,
      });
    } else {
      await onSubmit({
        kind: "entry",
        values: {
          ...transactionPayload,
          recurrence: values.is_recurring
            ? {
                frequency: values.recurrence_frequency,
                until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
              }
            : null,
        },
      });
    }

    onOpenChange(false);
  });

  const titleKey =
    mode === "edit-schedule" ? "editSeriesTitle" : mode === "edit-transaction" ? "editTitle" : "addTitle";
  const submitKey =
    mode === "edit-schedule" ? "editSeries" : mode === "edit-transaction" ? "edit" : "add";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "w-full border-l border-white/10 bg-[#234c58]/98 text-[#eef5f3] sm:inset-y-auto sm:right-6 sm:top-18 sm:h-auto sm:max-h-[calc(100vh-6rem)] sm:w-[22rem] sm:max-w-none sm:rounded-xl sm:border sm:shadow-[0_24px_80px_rgba(4,12,16,0.45)]",
          "[&_input]:border-white/12 [&_input]:bg-transparent [&_input]:text-[#eef5f3] [&_input]:placeholder:text-[#739296]",
          "[&_button[data-slot='select-trigger']]:border-white/12 [&_button[data-slot='select-trigger']]:bg-transparent [&_button[data-slot='select-trigger']]:text-[#eef5f3]",
          "[&_button[data-slot='switch']]:data-[checked]:bg-[#7fe8c5] [&_button[data-slot='switch']]:bg-white/10",
          "[&_label]:text-[#dbecea]",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t(titleKey)}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <Button type="button" variant="ghost" className="px-0 text-[#d8ebe6] hover:bg-transparent hover:text-white" onClick={() => onOpenChange(false)}>
              {t("submit.cancel")}
            </Button>
            <div className="min-w-0 flex-1 px-3">
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 border-0 bg-transparent px-2 text-center text-[14px] font-medium shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{kindsT("expense")}</SelectItem>
                      <SelectItem value="income">{kindsT("income")}</SelectItem>
                      <SelectItem value="transfer">{kindsT("transfer")}</SelectItem>
                      <SelectItem value="save_to_goal">{kindsT("save_to_goal")}</SelectItem>
                      <SelectItem value="spend_from_goal">{kindsT("spend_from_goal")}</SelectItem>
                      <SelectItem value="debt_payment">{kindsT("debt_payment")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <Button type="submit" variant="ghost" className="px-0 text-[#d8ebe6] hover:bg-transparent hover:text-white">
              {t(`submit.${submitKey}`)}
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
            {mode === "add" ? (
              <>
                {!isRecurring ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("fields.status")}</label>
                    <Controller
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">{t("status.paid")}</SelectItem>
                            <SelectItem value="planned">{t("status.planned")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldMessage error={form.formState.errors.status} />
                  </div>
                ) : null}
              </>
            ) : mode === "edit-transaction" ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t("fields.status")}</label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">{t("status.paid")}</SelectItem>
                        <SelectItem value="planned">{t("status.planned")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldMessage error={form.formState.errors.status} />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="transaction-date">
                {isRecurring && mode !== "edit-transaction" ? t("fields.startDate") : t("fields.date")}
              </label>
              <Input id="transaction-date" type="date" {...form.register("occurred_at")} />
              <FieldMessage error={form.formState.errors.occurred_at} />
            </div>

            {mode === "add" ? (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#eef5f3]">{t("fields.automatic")}</p>
                  <p className="text-xs text-[#739296]">{isRecurring ? t("automatic.on") : t("automatic.off")}</p>
                </div>
                <Controller
                  control={form.control}
                  name="is_recurring"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#eef5f3]">
                {statusTone === "paid" ? <CheckCircle2 className="size-4 text-[#7fe8c5]" /> : null}
                {statusTone === "overdue" ? <CircleAlert className="size-4 text-[#ffb13d]" /> : null}
                <span>{t("fields.statusSummary")}</span>
              </div>
              <span
                className={
                  statusTone === "paid"
                    ? "text-sm font-semibold text-[#7fe8c5]"
                    : statusTone === "overdue"
                      ? "text-sm font-semibold text-[#ffb13d]"
                      : "text-sm font-semibold text-[#8cb0b2]"
                }
              >
                {t(`statusBadge.${statusTone}`)}
              </span>
            </div>

            <Separator className="bg-white/10" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t("fields.recurrenceFrequency")}</label>
                <Controller
                  control={form.control}
                  name="recurrence_frequency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!isRecurring}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("recurrence.never")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">{t("recurrence.daily")}</SelectItem>
                        <SelectItem value="weekly">{t("recurrence.weekly")}</SelectItem>
                        <SelectItem value="monthly">{t("recurrence.monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {!isRecurring ? <p className="text-xs text-muted-foreground">{t("recurrence.never")}</p> : null}
                <FieldMessage error={form.formState.errors.recurrence_frequency} />
              </div>

              {isRecurring ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="transaction-until">
                    {t("fields.recurrenceUntil")}
                  </label>
                  <Input
                    id="transaction-until"
                    type="date"
                    value={recurrenceUntil ?? ""}
                    onChange={(event) => form.setValue("recurrence_until", event.target.value || null)}
                  />
                  <FieldMessage error={form.formState.errors.recurrence_until} />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(kind === "expense" || kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal" || kind === "debt_payment") ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{t("fields.sourceAccount")}</label>
                  <Controller
                    control={form.control}
                    name="source_account_id"
                    render={({ field }) => (
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("placeholders.sourceAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldMessage error={form.formState.errors.source_account_id} />
                </div>
              ) : null}

              {(kind === "income" || kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal" || kind === "debt_payment") ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">{t("fields.destinationAccount")}</label>
                  <Controller
                    control={form.control}
                    name="destination_account_id"
                    render={({ field }) => (
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("placeholders.destinationAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldMessage error={form.formState.errors.destination_account_id} />
                </div>
              ) : null}
            </div>

            {supportsBatch ? (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                      {(kind === "income" || kind === "expense") ? (
                        <Controller
                          control={form.control}
                          name={`line_items.${index}.category_id`}
                          render={({ field: itemField }) => (
                            <Select value={itemField.value ?? undefined} onValueChange={itemField.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t("placeholders.category")} />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      ) : (
                        <Controller
                          control={form.control}
                          name={`line_items.${index}.allocation_id`}
                          render={({ field: itemField }) => (
                            <Select value={itemField.value ?? undefined} onValueChange={itemField.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t("placeholders.goal")} />
                              </SelectTrigger>
                              <SelectContent>
                                {goalOptions.map((allocation) => (
                                  <SelectItem key={allocation.id} value={allocation.id}>
                                    {allocation.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      )}

                      <Controller
                        control={form.control}
                        name={`line_items.${index}.amount`}
                        render={({ field: itemField }) => (
                          <NumericField
                            id={`transaction-line-amount-${index}`}
                            label={t("fields.amount")}
                            value={itemField.value}
                            onChange={itemField.onChange}
                            hideLabel
                          />
                        )}
                      />

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-[#dbecea] hover:bg-white/10 hover:text-white"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <FieldMessage error={form.formState.errors.line_items?.[index]?.category_id as FieldError | undefined} />
                    <FieldMessage error={form.formState.errors.line_items?.[index]?.allocation_id as FieldError | undefined} />
                    <FieldMessage error={form.formState.errors.line_items?.[index]?.amount as FieldError | undefined} />
                  </div>
                ))}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#84a6a9]">{t("fields.total")}</p>
                    <p className="text-lg font-semibold text-[#eef5f3]">{totalAmount.toFixed(2)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="border border-white/10 bg-white/6 text-[#dbecea] hover:bg-white/10 hover:text-white" onClick={() => append(createEmptyLineItem())}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <FieldMessage error={form.formState.errors.line_items as FieldError | undefined} />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <>
                        <NumericField id="transaction-amount" label={t("fields.amount")} value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
                        <FieldMessage error={form.formState.errors.amount} />
                      </>
                    )}
                  />

                  {isMoveKind(kind) ? (
                    <Controller
                      control={form.control}
                      name="destination_amount"
                      render={({ field }) => (
                        <>
                          <NumericField
                            id="transaction-destination-amount"
                            label={t("fields.destinationAmount")}
                            value={field.value}
                            onChange={field.onChange}
                          />
                          <FieldMessage error={form.formState.errors.destination_amount} />
                        </>
                      )}
                    />
                  ) : null}
                </div>

                {isMoveKind(kind) ? (
                  <Controller
                    control={form.control}
                    name="fx_rate"
                    render={({ field }) => (
                      <>
                        <NumericField id="transaction-fx-rate" label={t("fields.fxRate")} value={field.value} onChange={field.onChange} />
                        <FieldMessage error={form.formState.errors.fx_rate} />
                      </>
                    )}
                  />
                ) : null}

                {(kind === "income" || kind === "expense" || kind === "debt_payment") ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("fields.category")}</label>
                    <Controller
                      control={form.control}
                      name="category_id"
                      render={({ field }) => (
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("placeholders.category")} />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldMessage error={form.formState.errors.category_id} />
                  </div>
                ) : null}

                {(kind === "save_to_goal" || kind === "spend_from_goal") ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t("fields.savingsGoal")}</label>
                    <Controller
                      control={form.control}
                      name="allocation_id"
                      render={({ field }) => (
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("placeholders.goal")} />
                          </SelectTrigger>
                          <SelectContent>
                            {goalOptions.map((allocation) => (
                              <SelectItem key={allocation.id} value={allocation.id}>
                                {allocation.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldMessage error={form.formState.errors.allocation_id} />
                  </div>
                ) : null}
              </>
            )}

            {kind === "debt_payment" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Controller
                  control={form.control}
                  name="principal_amount"
                  render={({ field }) => (
                    <>
                      <NumericField id="transaction-principal" label={t("fields.principal")} value={field.value} onChange={field.onChange} />
                      <FieldMessage error={form.formState.errors.principal_amount} />
                    </>
                  )}
                />
                <Controller
                  control={form.control}
                  name="interest_amount"
                  render={({ field }) => (
                    <>
                      <NumericField id="transaction-interest" label={t("fields.interest")} value={field.value} onChange={field.onChange} />
                      <FieldMessage error={form.formState.errors.interest_amount} />
                    </>
                  )}
                />
                <Controller
                  control={form.control}
                  name="extra_principal_amount"
                  render={({ field }) => (
                    <>
                      <NumericField id="transaction-extra-principal" label={t("fields.extraPrincipal")} value={field.value} onChange={field.onChange} />
                      <FieldMessage error={form.formState.errors.extra_principal_amount} />
                    </>
                  )}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="transaction-note">
                {t("fields.note")}
              </label>
              <Input id="transaction-note" {...form.register("note")} />
              <FieldMessage error={form.formState.errors.note} />
            </div>
          </div>

          <SheetFooter className="border-t border-white/10 p-3">
            <p className="text-[11px] leading-4 text-[#739296]">{t("description")}</p>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
