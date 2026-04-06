"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, type FieldError, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Account, Allocation, Category, Transaction, TransactionSchedule } from "@/types/finance";
import type {
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
} from "@/types/finance-schemas";

type BatchKind = "income" | "expense" | "save_to_goal" | "spend_from_goal";

type TransactionLineItemInput = {
  category_id: string | null;
  allocation_id: string | null;
  amount: number | null;
  note: string;
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

function supportsBatchItems(kind: Transaction["kind"]): kind is BatchKind {
  return kind === "income" || kind === "expense" || kind === "save_to_goal" || kind === "spend_from_goal";
}

function isMoveKind(kind: Transaction["kind"]) {
  return kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal";
}

function createEmptyLineItem(): TransactionLineItemInput {
  return { category_id: null, allocation_id: null, amount: null, note: "" };
}

function toSelectValue(value: string | null | undefined) {
  return value ?? "";
}

function FieldMessage({ error }: { error?: FieldError }) {
  if (!error?.message) return null;
  return <p className="text-sm text-destructive">{error.message}</p>;
}

function FormBlock({ children }: { children: React.ReactNode }) {
  return <section className="space-y-2 rounded-[24px] bg-muted/15 p-3 sm:p-3.5">{children}</section>;
}

function RowShell({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div
      className={
        label
          ? "grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1"
          : "min-h-10 rounded-xl px-2 py-1"
      }
    >
      {label ? <div className="min-w-0 text-[15px] text-muted-foreground">{label}</div> : null}
      <div className={label ? "min-w-0 flex items-center justify-end gap-2" : "min-w-0"}>{children}</div>
    </div>
  );
}

function PickerRow({ children }: { children: React.ReactNode }) {
  return <div className="min-h-11 rounded-2xl bg-background px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{children}</div>;
}

function buildSchema(
  t: ReturnType<typeof useTranslations<"transactions.form">>,
  mode: "add" | "edit-transaction" | "edit-schedule",
) {
  const opaqueId = z.string().trim().min(1).nullable();
  const lineItemSchema = z.object({
    category_id: opaqueId,
    allocation_id: opaqueId,
    amount: z.number().positive(t("validation.amountPositive")).nullable(),
    note: z.string().trim().max(500, t("validation.noteMax")),
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
      category_id: opaqueId,
      source_account_id: opaqueId,
      destination_account_id: opaqueId,
      allocation_id: opaqueId,
      is_recurring: z.boolean(),
      recurrence_frequency: z.enum(["daily", "weekly", "monthly"]),
      recurrence_until: z.string().trim().nullable(),
      line_items: z.array(lineItemSchema),
    })
    .superRefine((values, ctx) => {
      const batchMode = mode === "add" && supportsBatchItems(values.kind);
      const requireSource = ["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(values.kind);
      const requireDestination = ["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(values.kind);

      if (requireSource && !values.source_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_account_id"], message: t("validation.sourceRequired") });
      }
      if (requireDestination && !values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: t("validation.destinationRequired") });
      }
      if (values.source_account_id && values.destination_account_id && values.source_account_id === values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: t("validation.differentDestination") });
      }
      if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !values.allocation_id && !batchMode) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocation_id"], message: t("validation.goalRequired") });
      }
      if ((values.kind === "income" || values.kind === "expense") && !values.category_id && !batchMode) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: t("validation.categoryRequired") });
      }
      if (batchMode) {
        if (!values.line_items.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items"], message: t("validation.lineItemsRequired") });
        }
        values.line_items.forEach((item, index) => {
          if (!item.amount) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items", index, "amount"], message: t("validation.amountPositive") });
          }
          if ((values.kind === "income" || values.kind === "expense") && !item.category_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items", index, "category_id"], message: t("validation.categoryRequired") });
          }
          if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !item.allocation_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["line_items", index, "allocation_id"], message: t("validation.goalRequired") });
          }
        });
      }
      if (values.kind === "debt_payment") {
        const total = (values.principal_amount ?? 0) + (values.interest_amount ?? 0) + (values.extra_principal_amount ?? 0);
        if (total <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["principal_amount"], message: t("validation.debtBreakdownRequired") });
        }
        if (Math.abs(total - values.amount) > 0.01) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: t("validation.debtBreakdownMismatch") });
        }
      }
      if (isMoveKind(values.kind) && !batchMode && !values.destination_amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_amount"], message: t("validation.destinationAmountRequired") });
      }
      if (values.is_recurring && values.status !== "planned") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: t("validation.recurringMustBePlanned") });
      }
      if (values.is_recurring && values.recurrence_until && values.recurrence_until < values.occurred_at) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrence_until"], message: t("validation.recurrenceUntilBeforeStart") });
      }
    });
}

function normalizePayload(values: TransactionFormInputs): TransactionInput {
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

function defaults({
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
              note: schedule?.note ?? transaction?.note ?? "",
            },
          ],
  };
}

function inferBatchTitle(item: TransactionLineItemInput, kind: BatchKind, categories: Category[], allocations: Allocation[]) {
  if (kind === "income" || kind === "expense") return categories.find((category) => category.id === item.category_id)?.name ?? "";
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
  const commonActionsT = useTranslations("common.actions");
  const schema = useMemo(() => buildSchema(t, mode), [mode, t]);
  const form = useForm<TransactionFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: defaults({ transaction, schedule, initialKind, mode }),
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "line_items" });

  useEffect(() => {
    form.reset(defaults({ transaction, schedule, initialKind, mode }));
  }, [form, initialKind, mode, open, schedule, transaction]);

  const kind = useWatch({ control: form.control, name: "kind" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate" });
  const isRecurring = useWatch({ control: form.control, name: "is_recurring" });
  const sourceAccountId = useWatch({ control: form.control, name: "source_account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });
  const recurrenceUntil = useWatch({ control: form.control, name: "recurrence_until" });
  const lineItems = useWatch({ control: form.control, name: "line_items" });
  const supportsBatch = mode === "add" && supportsBatchItems(kind);
  const selectedType = kind === "income" ? "income" : "expense";
  const categoryOptions = categories.filter((category) => category.type === selectedType);
  const goalOptions = allocations.filter((allocation) => {
    if (kind === "save_to_goal") return allocation.account_id === destinationAccountId;
    if (kind === "spend_from_goal") return allocation.account_id === sourceAccountId;
    return true;
  });
  const totalAmount = (lineItems ?? []).reduce((sum, item) => sum + (item?.amount ?? 0), 0);
  const formId = "transaction-form-sheet";
  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const goalNameById = new Map(allocations.map((allocation) => [allocation.id, allocation.name]));

  useEffect(() => {
    if (supportsBatch && !fields.length) {
      replace([createEmptyLineItem()]);
    }
  }, [fields.length, replace, supportsBatch]);

  useEffect(() => {
    if (isMoveKind(kind) && fxRate && amount) {
      form.setValue("destination_amount", Number((amount * fxRate).toFixed(2)), { shouldValidate: true });
    }
  }, [amount, form, fxRate, kind]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (supportsBatchItems(values.kind) && mode === "add") {
      const batchKind = values.kind;
      await onSubmit({
        kind: "entry-batch",
        values: {
          entries: values.line_items.map((item) => ({
            ...normalizePayload({
              ...values,
              title: inferBatchTitle(item, batchKind, categories, allocations),
              note: item.note,
              amount: item.amount ?? 0,
              category_id: batchKind === "income" || batchKind === "expense" ? item.category_id : null,
              allocation_id: batchKind === "save_to_goal" || batchKind === "spend_from_goal" ? item.allocation_id : null,
              status: values.is_recurring ? "planned" : values.status,
            }),
            recurrence: values.is_recurring
              ? { frequency: values.recurrence_frequency, until_date: values.recurrence_until?.trim() ? values.recurrence_until : null }
              : null,
          })),
        },
      });
      onOpenChange(false);
      return;
    }

    const payload = normalizePayload({
      ...values,
      title: inferSingleTitle(values, accounts, categories, allocations),
      status: values.is_recurring ? "planned" : values.status,
    });

    if (mode === "edit-schedule") {
      await onSubmit({
        kind: "schedule",
        values: {
          ...payload,
          recurrence: {
            frequency: values.recurrence_frequency,
            until_date: values.recurrence_until?.trim() ? values.recurrence_until : null,
          },
        },
      });
    } else if (mode === "edit-transaction") {
      await onSubmit({ kind: "transaction", values: payload });
    } else {
      await onSubmit({
        kind: "entry",
        values: {
          ...payload,
          recurrence: values.is_recurring
            ? { frequency: values.recurrence_frequency, until_date: values.recurrence_until?.trim() ? values.recurrence_until : null }
            : null,
        },
      });
    }
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l-0 bg-background p-0 sm:top-6 sm:right-6 sm:h-[calc(100vh-3rem)] sm:w-[29rem] sm:max-w-none sm:rounded-[28px] sm:border sm:border-border/30 sm:shadow-[0_24px_72px_rgba(15,23,42,0.14)]"
      >
        <form id={formId} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="gap-0 border-0 px-4 pt-4 pb-2 sm:px-5">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <Button type="button" variant="ghost" size="sm" className="justify-start px-0 text-[15px] font-normal" onClick={() => onOpenChange(false)}>
                {t("submit.cancel")}
              </Button>
              <div className="flex justify-center">
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={mode !== "add"}>
                      <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-2 py-0 text-center text-[1.1rem] font-medium capitalize shadow-none">
                        <span className="truncate">{kindsT(field.value)}</span>
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
              <Button type="submit" form={formId} variant="ghost" size="sm" className="justify-end px-0 text-[15px] font-medium">
                {commonActionsT("save")}
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
            <div className="space-y-3">
              <FormBlock>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1">
                  <div className="min-w-0 text-[15px]">
                    <Input
                      id="transaction-date"
                      type="date"
                      className="h-auto w-full border-0 bg-transparent px-0 py-0 text-[15px] shadow-none"
                      {...form.register("occurred_at")}
                    />
                  </div>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={mode === "edit-schedule" || isRecurring}>
                        <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right text-[15px] text-muted-foreground shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">{t("status.paid")}</SelectItem>
                          <SelectItem value="planned">{t("status.planned")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <FieldMessage error={form.formState.errors.occurred_at} />
                <FieldMessage error={form.formState.errors.status} />

                {mode === "add" ? (
                  <RowShell label={t("fields.automatic")}>
                    <Controller control={form.control} name="is_recurring" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                  </RowShell>
                ) : null}

                {isRecurring ? (
                  <RowShell label={t("fields.recurrenceFrequency")}>
                    <div className="flex items-center gap-3">
                      <Controller
                        control={form.control}
                        name="recurrence_frequency"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right shadow-none">
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
                      <Input id="transaction-until" type="date" className="h-auto w-[9rem] border-0 bg-transparent px-0 py-0 text-right text-muted-foreground shadow-none" value={recurrenceUntil ?? ""} onChange={(event) => form.setValue("recurrence_until", event.target.value || null)} />
                    </div>
                  </RowShell>
                ) : null}

                {["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) ? (
                  <PickerRow>
                    <div className="flex flex-col gap-1">
                      <Controller
                        control={form.control}
                        name="source_account_id"
                        render={({ field }) => (
                          <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                            <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-[15px] shadow-none">
                              <span className="truncate text-left">
                                {field.value ? accountNameById.get(field.value) ?? field.value : t("placeholders.sourceAccount")}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FieldMessage error={form.formState.errors.source_account_id} />
                    </div>
                  </PickerRow>
                ) : null}

                {["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) ? (
                  <PickerRow>
                    <div className="flex flex-col gap-1">
                      <Controller
                        control={form.control}
                        name="destination_account_id"
                        render={({ field }) => (
                          <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                            <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-[15px] shadow-none">
                              <span className="truncate text-left">
                                {field.value ? accountNameById.get(field.value) ?? field.value : t("placeholders.destinationAccount")}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FieldMessage error={form.formState.errors.destination_account_id} />
                    </div>
                  </PickerRow>
                ) : null}
              </FormBlock>

              {supportsBatch ? (
                <FormBlock>
                  {fields.map((field, index) => (
                    <PickerRow key={field.id}>
                      <div className="grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-3">
                        <div className="min-w-0">
                          {kind === "income" || kind === "expense" ? (
                            <Controller
                              control={form.control}
                              name={`line_items.${index}.category_id`}
                              render={({ field: itemField }) => (
                                <Select value={toSelectValue(itemField.value)} onValueChange={itemField.onChange}>
                                  <SelectTrigger className="h-auto w-full border-0 bg-transparent px-0 py-0 text-left text-[15px] shadow-none">
                                    <span className="truncate">
                                      {itemField.value ? categoryNameById.get(itemField.value) ?? itemField.value : t("placeholders.category")}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categoryOptions.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          ) : (
                            <Controller
                              control={form.control}
                              name={`line_items.${index}.allocation_id`}
                              render={({ field: itemField }) => (
                                <Select value={toSelectValue(itemField.value)} onValueChange={itemField.onChange}>
                                  <SelectTrigger className="h-auto w-full border-0 bg-transparent px-0 py-0 text-left text-[15px] shadow-none">
                                    <span className="truncate">
                                      {itemField.value ? goalNameById.get(itemField.value) ?? itemField.value : t("placeholders.goal")}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {goalOptions.map((allocation) => <SelectItem key={allocation.id} value={allocation.id}>{allocation.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )}
                        </div>

                        <Controller
                          control={form.control}
                          name={`line_items.${index}.amount`}
                          render={({ field: itemField }) => (
                            <Input
                              id={`transaction-line-amount-${index}`}
                              type="number"
                              step="0.01"
                              className="h-auto border-0 bg-transparent px-0 py-0 text-right text-[15px] font-medium shadow-none"
                              value={itemField.value ?? ""}
                              onChange={(event) => itemField.onChange(event.target.value ? Number(event.target.value) : null)}
                            />
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_88px_auto] gap-3">
                        <Controller
                          control={form.control}
                          name={`line_items.${index}.note`}
                          render={({ field: itemField }) => (
                            <Input
                              id={`transaction-line-note-${index}`}
                              className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none"
                              placeholder={t("placeholders.lineNote")}
                              value={itemField.value}
                              onChange={itemField.onChange}
                            />
                          )}
                        />
                        <div />
                        <div />
                      </div>

                      <div className="mt-1 space-y-1">
                        <FieldMessage error={form.formState.errors.line_items?.[index]?.category_id as FieldError | undefined} />
                        <FieldMessage error={form.formState.errors.line_items?.[index]?.allocation_id as FieldError | undefined} />
                        <FieldMessage error={form.formState.errors.line_items?.[index]?.amount as FieldError | undefined} />
                        <FieldMessage error={form.formState.errors.line_items?.[index]?.note as FieldError | undefined} />
                      </div>
                    </PickerRow>
                  ))}

                  <RowShell label={t("fields.total")}>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-[1.05rem] font-semibold">{totalAmount.toFixed(2)}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => append(createEmptyLineItem())}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </RowShell>

                  <FieldMessage error={form.formState.errors.line_items as FieldError | undefined} />
                </FormBlock>
              ) : (
                <FormBlock>
                  <RowShell label={t("fields.amount")}>
                    <div className="flex flex-col items-end gap-1">
                      <Controller
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <Input
                            id="transaction-amount"
                            type="number"
                            step="0.01"
                            className="h-auto w-[11rem] border-0 bg-transparent px-0 py-0 text-right text-[1.05rem] font-medium shadow-none"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : 0)}
                          />
                        )}
                      />
                      <FieldMessage error={form.formState.errors.amount} />
                    </div>
                  </RowShell>

                  {isMoveKind(kind) ? (
                    <RowShell label={t("fields.destinationAmount")}>
                      <div className="flex flex-col items-end gap-1">
                        <Controller
                          control={form.control}
                          name="destination_amount"
                          render={({ field }) => (
                            <Input
                              id="transaction-destination-amount"
                              type="number"
                              step="0.01"
                              className="h-auto w-[11rem] border-0 bg-transparent px-0 py-0 text-right text-[1.05rem] font-medium shadow-none"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : null)}
                            />
                          )}
                        />
                        <FieldMessage error={form.formState.errors.destination_amount} />
                      </div>
                    </RowShell>
                  ) : null}

                  {isMoveKind(kind) ? (
                    <RowShell label={t("fields.fxRate")}>
                      <div className="flex flex-col items-end gap-1">
                        <Controller
                          control={form.control}
                          name="fx_rate"
                          render={({ field }) => (
                            <Input
                              id="transaction-fx-rate"
                              type="number"
                              step="0.01"
                              className="h-auto w-[8rem] border-0 bg-transparent px-0 py-0 text-right shadow-none"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : null)}
                            />
                          )}
                        />
                        <FieldMessage error={form.formState.errors.fx_rate} />
                      </div>
                    </RowShell>
                  ) : null}

                  {kind === "income" || kind === "expense" || kind === "debt_payment" ? (
                    <PickerRow>
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={form.control}
                          name="category_id"
                          render={({ field }) => (
                            <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                              <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-[15px] shadow-none">
                                <span className="truncate text-left">
                                  {field.value ? categoryNameById.get(field.value) ?? field.value : t("placeholders.category")}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                      />
                      <FieldMessage error={form.formState.errors.category_id} />
                    </div>
                  </PickerRow>
                ) : null}

                {kind === "save_to_goal" || kind === "spend_from_goal" ? (
                  <PickerRow>
                    <div className="flex flex-col gap-1">
                      <Controller
                        control={form.control}
                        name="allocation_id"
                          render={({ field }) => (
                            <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                              <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-[15px] shadow-none">
                                <span className="truncate text-left">
                                  {field.value ? goalNameById.get(field.value) ?? field.value : t("placeholders.goal")}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {goalOptions.map((allocation) => <SelectItem key={allocation.id} value={allocation.id}>{allocation.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                      />
                      <FieldMessage error={form.formState.errors.allocation_id} />
                    </div>
                  </PickerRow>
                ) : null}

                  {kind === "debt_payment" ? (
                    <>
                      <RowShell label={t("fields.principal")}>
                        <Controller
                          control={form.control}
                          name="principal_amount"
                          render={({ field }) => <Input id="transaction-principal" type="number" step="0.01" className="h-auto w-[8rem] border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : null)} />}
                        />
                      </RowShell>
                      <RowShell label={t("fields.interest")}>
                        <Controller
                          control={form.control}
                          name="interest_amount"
                          render={({ field }) => <Input id="transaction-interest" type="number" step="0.01" className="h-auto w-[8rem] border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : null)} />}
                        />
                      </RowShell>
                      <RowShell label={t("fields.extraPrincipal")}>
                        <Controller
                          control={form.control}
                          name="extra_principal_amount"
                          render={({ field }) => <Input id="transaction-extra-principal" type="number" step="0.01" className="h-auto w-[8rem] border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : null)} />}
                        />
                      </RowShell>
                    </>
                  ) : null}

                  <PickerRow>
                    <Input id="transaction-note" className="w-full border-0 bg-transparent px-0 py-0 text-[15px] shadow-none" placeholder={t("placeholders.lineNote")} {...form.register("note")} />
                  </PickerRow>
                </FormBlock>
              )}
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
