"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, isSameYear, parseISO, startOfDay } from "date-fns";
import { ArrowLeftRight, BanknoteArrowDown, CalendarIcon, CheckCircle2, Clock3, CreditCard, Landmark, PiggyBank, Plus, ReceiptText, TrendingUp, WalletCards, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, type FieldError, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { InlineIcon } from "@/components/ui/inline-icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
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
  return <section className="space-y-2">{children}</section>;
}

function SplitRow({
  left,
  right,
  trailing,
  children,
  align = "center",
  rowClassName,
  className,
  ...props
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "start";
  rowClassName?: string;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("relative min-h-10 py-1.5", rowClassName)} {...props}>
      <div
        className={`${className ?? ""} grid gap-3 ${trailing ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} ${
          align === "start" ? "items-start" : "items-center"
        }`}
      >
        <div className="min-w-0">{left}</div>
        {right ? <div className="min-w-0">{right}</div> : null}
        {trailing ? <div className="flex items-center justify-end">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-1 space-y-1">{children}</div> : null}
    </div>
  );
}

function RowShell({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div
      className={
        label
          ? "grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1"
          : "min-h-10 py-1"
      }
    >
      {label ? <div className="min-w-0 text-sm text-foreground">{label}</div> : null}
      <div className={label ? "min-w-0 flex items-center justify-end gap-2" : "min-w-0"}>{children}</div>
    </div>
  );
}

function PickerRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-11 border-b border-border/70 py-2", className)}>{children}</div>;
}

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...fractionParts] = normalized.split(".");
  return fractionParts.length > 0 ? `${integerPart}.${fractionParts.join("")}` : integerPart;
}

const DecimalInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
    hidePlaceholderOnFocus?: boolean;
    value: number | null | undefined;
    onValueChange: (value: number | null) => void;
  }
>(function DecimalInput({ value, onValueChange, inputMode = "decimal", hidePlaceholderOnFocus = false, ...props }, ref) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [isFocused, setIsFocused] = useState(false);
  const displayValue = isFocused ? draft : value == null ? "" : String(value);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode}
      placeholder={hidePlaceholderOnFocus && isFocused ? "" : props.placeholder}
      value={displayValue}
      onFocus={(event) => {
        setDraft(value == null ? "" : String(value));
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        const sanitized = sanitizeDecimalInput(event.target.value);
        setDraft(sanitized);
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const sanitized = sanitizeDecimalInput(event.target.value);
        setDraft(sanitized);

        if (!sanitized) {
          onValueChange(null);
          return;
        }

        if (sanitized === ".") return;

        const parsed = Number(sanitized);
        if (!Number.isNaN(parsed)) {
          onValueChange(parsed);
        }
      }}
    />
  );
});

function getAccountIcon(account?: Account | null) {
  if (!account) return BanknoteArrowDown;
  if (account.type === "saving") return PiggyBank;
  if (account.type === "credit_card") return CreditCard;
  if (account.type === "debt") return Landmark;
  return BanknoteArrowDown;
}

function getKindIcon(kind: Transaction["kind"]) {
  switch (kind) {
    case "income":
      return TrendingUp;
    case "transfer":
      return ArrowLeftRight;
    case "save_to_goal":
    case "spend_from_goal":
      return PiggyBank;
    case "debt_payment":
      return WalletCards;
    case "expense":
    default:
      return ReceiptText;
  }
}

function getMostUsedAccountId({
  kind,
  role,
  accounts,
  transactions,
}: {
  kind: Transaction["kind"];
  role: "source" | "destination";
  accounts: Account[];
  transactions: Transaction[];
}) {
  const eligibleAccountIds = new Set(accounts.map((account) => account.id));
  const usage = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.kind !== kind) continue;
    const accountId = role === "source" ? transaction.source_account_id : transaction.destination_account_id;
    if (!accountId || !eligibleAccountIds.has(accountId)) continue;
    usage.set(accountId, (usage.get(accountId) ?? 0) + 1);
  }

  return [...usage.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function formatTransactionDate(value: string) {
  const parsed = parseISO(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return format(parsed, isSameYear(parsed, new Date()) ? "d MMM" : "d MMM yyyy");
}

function FlatDatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex min-h-8 items-center gap-2 border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground outline-none focus:outline-none focus-visible:ring-0",
          className,
        )}
      >
        <CalendarIcon className="size-4 opacity-70" />
        <span>{formatTransactionDate(value)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
          }}
        />
      </PopoverContent>
    </Popover>
  );
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
  defaultSourceAccountId,
}: {
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  mode: "add" | "edit-transaction" | "edit-schedule";
  defaultSourceAccountId?: string | null;
}): TransactionFormInputs {
  const currentKind = schedule?.kind ?? transaction?.kind ?? initialKind ?? "expense";
  const isAddMode = mode === "add";
  const incomeKinds = new Set<Transaction["kind"]>(["income", "save_to_goal"]);
  const defaultSourceId = isAddMode && defaultSourceAccountId ? defaultSourceAccountId : null;
  const defaultDestId = isAddMode && defaultSourceAccountId && incomeKinds.has(currentKind) ? defaultSourceAccountId : null;
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
    source_account_id: schedule?.source_account_id ?? transaction?.source_account_id ?? defaultSourceId,
    destination_account_id: schedule?.destination_account_id ?? transaction?.destination_account_id ?? defaultDestId,
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
  defaultSourceAccountId,
  accounts,
  allocations,
  categories,
  onOpenChange,
  onSubmit,
  transactions = [],
}: {
  open: boolean;
  mode: "add" | "edit-transaction" | "edit-schedule";
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  defaultSourceAccountId?: string | null;
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  transactions?: Transaction[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void;
}) {
  const t = useTranslations("transactions.form");
  const kindsT = useTranslations("transactions.kinds");
  const commonActionsT = useTranslations("common.actions");
  const schema = useMemo(() => buildSchema(t, mode), [mode, t]);
  const form = useForm<TransactionFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: defaults({ transaction, schedule, initialKind, mode, defaultSourceAccountId }),
  });
  const { fields, append, insert, remove, replace } = useFieldArray({ control: form.control, name: "line_items" });

  useEffect(() => {
    form.reset(defaults({ transaction, schedule, initialKind, mode, defaultSourceAccountId }));
  }, [form, initialKind, mode, open, schedule, transaction, defaultSourceAccountId]);

  const kind = useWatch({ control: form.control, name: "kind" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate" });
  const isRecurring = useWatch({ control: form.control, name: "is_recurring" });
  const sourceAccountId = useWatch({ control: form.control, name: "source_account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });
  const occurredAt = useWatch({ control: form.control, name: "occurred_at" });
  const status = useWatch({ control: form.control, name: "status" });
  const recurrenceUntil = useWatch({ control: form.control, name: "recurrence_until" });
  const note = useWatch({ control: form.control, name: "note" });
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
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const goalNameById = new Map(allocations.map((allocation) => [allocation.id, allocation.name]));
  const amountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const lineTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lineMenu, setLineMenu] = useState<{ index: number; x: number; y: number } | null>(null);

  const appendLineItem = () => {
    append(createEmptyLineItem());
    setTimeout(() => {
      const nextIndex = fields.length;
      lineTriggerRefs.current[nextIndex]?.click();
    }, 0);
  };

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

  useEffect(() => {
    if (mode !== "add") return;
    const nextStatus = isBefore(startOfDay(parseISO(occurredAt)), startOfDay(new Date())) || occurredAt === new Date().toISOString().slice(0, 10)
      ? "paid"
      : "planned";
    form.setValue("status", nextStatus, { shouldValidate: true });
  }, [form, mode, occurredAt]);

  useEffect(() => {
    if (mode === "edit-schedule") return;
    if (status === "paid") {
      form.setValue("is_recurring", false, { shouldValidate: true });
    }
  }, [form, mode, status]);

  const primaryBatchAccount =
    kind === "income"
      ? accountById.get(destinationAccountId ?? "")
      : accountById.get(sourceAccountId ?? "");
  const primaryCurrencySymbol = getCurrencySymbol(primaryBatchAccount?.currency ?? "EUR");
  const sourceAccount = accountById.get(sourceAccountId ?? "");
  const destinationAccount = accountById.get(destinationAccountId ?? "");
  const sourceCurrencySymbol = getCurrencySymbol(sourceAccount?.currency ?? "EUR");
  const destinationCurrencySymbol = getCurrencySymbol(destinationAccount?.currency ?? sourceAccount?.currency ?? "EUR");
  const mostUsedSourceAccountId = useMemo(
    () => getMostUsedAccountId({ kind, role: "source", accounts, transactions }),
    [accounts, kind, transactions],
  );
  const mostUsedDestinationAccountId = useMemo(
    () => getMostUsedAccountId({ kind, role: "destination", accounts, transactions }),
    [accounts, kind, transactions],
  );

  useEffect(() => {
    if (!open || mode !== "add") return;

    if (["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) && !sourceAccountId) {
      form.setValue("source_account_id", mostUsedSourceAccountId ?? accounts[0]?.id ?? null, { shouldValidate: false });
    }

    if (["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) && !destinationAccountId) {
      form.setValue("destination_account_id", mostUsedDestinationAccountId ?? accounts[0]?.id ?? null, { shouldValidate: false });
    }
  }, [
    accounts,
    destinationAccountId,
    form,
    kind,
    mode,
    mostUsedDestinationAccountId,
    mostUsedSourceAccountId,
    open,
    sourceAccountId,
  ]);

  useEffect(() => {
    if (!lineMenu) return;

    const closeMenu = () => setLineMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [lineMenu]);

  const openLineMenu = (index: number, x: number, y: number) => {
    setLineMenu({ index, x, y });
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

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
        className="w-full gap-0 border-l-0 bg-background p-0 sm:top-6 sm:right-0 sm:h-[calc(100vh-3rem)] sm:w-[42rem] sm:max-w-none sm:border sm:border-border/30 sm:border-r-0 sm:shadow-[0_24px_72px_rgba(15,23,42,0.14)]"
      >
        <form id={formId} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="gap-0 border-0 px-4 pt-4 pb-2 sm:px-5">
                <div className="relative flex justify-center">
                  <Controller
                    control={form.control}
                    name="kind"
                    render={({ field }) => {
                    const KindIcon = getKindIcon(field.value);

                      return (
                      <Select value={field.value} onValueChange={field.onChange} disabled={mode !== "add"}>
                        <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-2 py-0 text-center text-[0.95rem] font-medium capitalize shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                        <span className="inline-flex items-center gap-2 truncate">
                          <KindIcon className="size-4 opacity-70" />
                          <span>{kindsT(field.value)}</span>
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
                      </SelectContent>
                      </Select>
                    )}}
                  />
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
              {supportsBatch ? (
                <FormBlock>
                    {["expense", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) ? (
                      <PickerRow className="border-b-0 pt-4">
                      <Controller
                        control={form.control}
                        name="source_account_id"
                        render={({ field }) => {
                          const selectedAccount = accountById.get(field.value ?? "");
                          const AccountIcon = getAccountIcon(selectedAccount);

                          return (
                            <div className="flex flex-col gap-1">
                              <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                                <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <InlineIcon icon={AccountIcon} />
                                    <span className={cn("truncate text-left", selectedAccount ? "text-foreground" : "text-muted-foreground")}>
                                      {selectedAccount?.name ?? t("placeholders.sourceAccount")}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => {
                                    const AccountIconOption = getAccountIcon(account);
                                    return (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <InlineIcon icon={AccountIconOption} />
                                          <span className="truncate">{account.name}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FieldMessage error={form.formState.errors.source_account_id} />
                            </div>
                          );
                        }}
                      />
                    </PickerRow>
                  ) : null}

                    {kind === "income" ? (
                      <PickerRow className="border-b-0 pt-4">
                      <Controller
                        control={form.control}
                        name="destination_account_id"
                        render={({ field }) => {
                          const selectedAccount = accountById.get(field.value ?? "");
                          const AccountIcon = getAccountIcon(selectedAccount);

                          return (
                            <div className="flex flex-col gap-1">
                              <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                                <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <InlineIcon icon={AccountIcon} />
                                    <span className={cn("truncate text-left", selectedAccount ? "text-foreground" : "text-muted-foreground")}>
                                      {selectedAccount?.name ?? t("placeholders.destinationAccount")}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => {
                                    const AccountIconOption = getAccountIcon(account);
                                    return (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <InlineIcon icon={AccountIconOption} />
                                          <span className="truncate">{account.name}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FieldMessage error={form.formState.errors.destination_account_id} />
                            </div>
                          );
                        }}
                      />
                    </PickerRow>
                  ) : null}

                    {fields.map((field, index) => (
                        <SplitRow
                          key={field.id}
                          rowClassName="min-h-0 py-0"
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openLineMenu(index, event.clientX, event.clientY);
                      }}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "touch") return;
                        clearLongPressTimer();
                        longPressTimerRef.current = setTimeout(() => {
                          openLineMenu(index, event.clientX, event.clientY);
                        }, 450);
                      }}
                      onPointerUp={clearLongPressTimer}
                      onPointerCancel={clearLongPressTimer}
                      onPointerLeave={clearLongPressTimer}
                      left={
                          kind === "income" || kind === "expense" ? (
                            <Controller
                              control={form.control}
                              name={`line_items.${index}.category_id`}
                              render={({ field: itemField }) => (
                                <CategoryCascadePicker
                                  categories={categoryOptions}
                                  value={itemField.value}
                                  onSelect={(value) => {
                                    itemField.onChange(value);
                                    setTimeout(() => amountInputRefs.current[index]?.focus(), 0);
                                  }}
                                  placeholder={t("placeholders.category")}
                                  triggerClassName="h-auto border-0 bg-transparent px-0 py-0 text-left text-sm leading-5 shadow-none outline-none hover:bg-transparent"
                                  contentClassName="min-w-[16rem]"
                                />
                              )}
                            />
                          ) : (
                            <Controller
                              control={form.control}
                              name={`line_items.${index}.allocation_id`}
                              render={({ field: itemField }) => (
                                <Select value={toSelectValue(itemField.value)} onValueChange={itemField.onChange}>
                                  <SelectTrigger
                                    ref={(node) => {
                                      lineTriggerRefs.current[index] = node;
                                    }}
                                      className="h-auto w-full border-0 bg-transparent px-0 py-0 text-left text-sm leading-5 shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0 [&>svg:last-child]:hidden"
                                  >
                                      <span className={cn("truncate capitalize", itemField.value ? "text-foreground" : "text-muted-foreground")}>
                                        {itemField.value ? goalNameById.get(itemField.value) ?? itemField.value : t("placeholders.goal")}
                                      </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {goalOptions.map((allocation) => (
                                      <SelectItem key={allocation.id} value={allocation.id} className="capitalize">
                                        {allocation.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )
                      }
                      right={
                        <Controller
                          control={form.control}
                          name={`line_items.${index}.amount`}
                          render={({ field: itemField }) => (
                            <div className="flex items-center justify-end gap-2">
                                <DecimalInput
                                  id={`transaction-line-amount-${index}`}
                                  ref={(node) => {
                                    amountInputRefs.current[index] = node;
                                  }}
                                  className="h-7 w-[5.25rem] rounded-none border-0 bg-transparent px-0 py-0.5 text-right text-base leading-6 font-medium tabular-nums shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                                  hidePlaceholderOnFocus
                                  placeholder="0.00"
                                  value={itemField.value ?? null}
                                  onValueChange={itemField.onChange}
                                />
                                <span className="text-sm text-foreground">{primaryCurrencySymbol}</span>
                            </div>
                          )}
                        />
                      }
                      trailing={
                        null
                      }
                    >
                      <FieldMessage error={form.formState.errors.line_items?.[index]?.category_id as FieldError | undefined} />
                      <FieldMessage error={form.formState.errors.line_items?.[index]?.allocation_id as FieldError | undefined} />
                      <FieldMessage error={form.formState.errors.line_items?.[index]?.amount as FieldError | undefined} />
                    </SplitRow>
                  ))}

                    <SplitRow
                      rowClassName="min-h-6 py-0 -mt-1"
                      left={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 justify-start gap-2 border-0 px-2 text-foreground shadow-none hover:bg-accent/40 hover:text-foreground focus-visible:ring-0"
                          onClick={appendLineItem}
                        >
                          <Plus data-icon="inline-start" />
                          {commonActionsT("add")}
                        </Button>
                      }
                      right={
                        fields.length > 1 ? (
                          <div className="flex items-center justify-end gap-2 text-sm font-semibold tabular-nums">
                            <span>{totalAmount.toFixed(2)}</span>
                            <span className="text-sm font-semibold text-foreground">{primaryCurrencySymbol}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-transparent">0.00</span>
                        )
                      }
                    />

                  <FieldMessage error={form.formState.errors.line_items as FieldError | undefined} />

                    {lineMenu ? (
                      <div
                        className="fixed z-50 min-w-36 rounded-[var(--radius-floating)] bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
                        style={{ left: lineMenu.x, top: lineMenu.y }}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-accent"
                          onClick={() => {
                            const line = form.getValues(`line_items.${lineMenu.index}`);
                            insert(lineMenu.index + 1, { ...line });
                          setLineMenu(null);
                        }}
                      >
                        {commonActionsT("duplicate")}
                      </button>
                        <button
                          type="button"
                          className="flex w-full items-center rounded-[var(--radius-control)] px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            remove(lineMenu.index);
                            setLineMenu(null);
                        }}
                      >
                        {commonActionsT("delete")}
                      </button>
                    </div>
                  ) : null}

                    <SplitRow
                      rowClassName="pt-5"
                      left={
                          <Controller
                          control={form.control}
                          name="occurred_at"
                          render={({ field }) => (
                            <FlatDatePicker value={field.value} onChange={field.onChange} />
                          )}
                        />
                    }
                    right={
                      <Controller
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger
                              className={`h-auto w-auto rounded-full border-0 px-2.5 py-1 text-right text-[14px] font-medium shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0 data-[popup-open]:opacity-90 ${
                                field.value === "paid" ? "bg-emerald-50" : "bg-amber-50"
                              }`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full ${
                                  field.value === "paid"
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {field.value === "paid" ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                                <span>{field.value === "paid" ? t("status.paid") : t("status.planned")}</span>
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">{t("status.paid")}</SelectItem>
                              <SelectItem value="planned">{t("status.planned")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    }
                  >
                      <FieldMessage error={form.formState.errors.occurred_at} />
                      <FieldMessage error={form.formState.errors.status} />
                  </SplitRow>

                    {status === "planned" ? (
                      <>
                        <SplitRow
                          rowClassName="min-h-8 py-0 pt-4"
                          left={<span className="text-sm text-foreground">{t("fields.recurrenceFrequency")}</span>}
                          right={
                            <Controller
                              control={form.control}
                              name="recurrence_frequency"
                              render={({ field }) => (
                                <Select
                                  value={isRecurring ? field.value : "never"}
                                  onValueChange={(value) => {
                                    if (value === "never") {
                                      form.setValue("is_recurring", false, { shouldValidate: true });
                                      form.setValue("recurrence_until", null, { shouldValidate: true });
                                      return;
                                    }
                                    form.setValue("is_recurring", true, { shouldValidate: true });
                                    field.onChange(value);
                                  }}
                                >
                                  <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                                    <SelectValue className="capitalize" placeholder={t("recurrence.never")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="never" className="capitalize">{t("recurrence.never")}</SelectItem>
                                    <SelectItem value="daily" className="capitalize">{t("recurrence.daily")}</SelectItem>
                                    <SelectItem value="weekly" className="capitalize">{t("recurrence.weekly")}</SelectItem>
                                    <SelectItem value="monthly" className="capitalize">{t("recurrence.monthly")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          }
                        />
                        {isRecurring ? (
                          <SplitRow
                            rowClassName="min-h-8 py-0 -mt-1"
                            left={<span className="text-sm text-foreground">{t("fields.recurrenceUntil")}</span>}
                            right={
                              <FlatDatePicker
                                value={recurrenceUntil ?? occurredAt}
                                onChange={(value) => form.setValue("recurrence_until", value, { shouldValidate: true })}
                                className="justify-end text-right"
                              />
                            }
                          >
                            <FieldMessage error={form.formState.errors.recurrence_until} />
                          </SplitRow>
                        ) : null}
                      </>
                    ) : null}

                    <PickerRow className={cn("pt-4", !note?.trim() && "border-b-0")}>
                      <div className="flex flex-col gap-1">
                        <Input
                          id="transaction-note"
                          className="h-10 w-full rounded-none border-0 bg-transparent px-0 py-1 text-base leading-7 shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                          placeholder={t("placeholders.note")}
                          {...form.register("note")}
                        />
                        <FieldMessage error={form.formState.errors.note} />
                      </div>
                    </PickerRow>

                  </FormBlock>
                ) : null}

              {supportsBatch ? null : (
                <FormBlock>
                  {["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) ? (
                    <PickerRow className="border-b-0 pt-4">
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={form.control}
                          name="source_account_id"
                          render={({ field }) => {
                            const selectedAccount = accountById.get(field.value ?? "");
                            const AccountIcon = getAccountIcon(selectedAccount);

                            return (
                              <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                                <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <InlineIcon icon={AccountIcon} />
                                    <span className={cn("truncate text-left", field.value ? "text-foreground" : "text-muted-foreground")}>
                                      {field.value ? accountNameById.get(field.value) ?? field.value : t("placeholders.sourceAccount")}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => {
                                    const AccountIconOption = getAccountIcon(account);
                                    return (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <InlineIcon icon={AccountIconOption} />
                                          <span className="truncate">{account.name}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                        <FieldMessage error={form.formState.errors.source_account_id} />
                      </div>
                    </PickerRow>
                  ) : null}

                  {["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"].includes(kind) ? (
                    <PickerRow className="border-b-0">
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={form.control}
                          name="destination_account_id"
                          render={({ field }) => {
                            const selectedAccount = accountById.get(field.value ?? "");
                            const AccountIcon = getAccountIcon(selectedAccount);

                            return (
                              <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                                <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <InlineIcon icon={AccountIcon} />
                                    <span className={cn("truncate text-left", field.value ? "text-foreground" : "text-muted-foreground")}>
                                      {field.value ? accountNameById.get(field.value) ?? field.value : t("placeholders.destinationAccount")}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => {
                                    const AccountIconOption = getAccountIcon(account);
                                    return (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex min-w-0 items-center gap-2">
                                          <InlineIcon icon={AccountIconOption} />
                                          <span className="truncate">{account.name}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                        <FieldMessage error={form.formState.errors.destination_account_id} />
                      </div>
                    </PickerRow>
                  ) : null}

                  {kind === "income" || kind === "expense" || kind === "debt_payment" ? (
                    <PickerRow className="border-b-0">
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={form.control}
                          name="category_id"
                          render={({ field }) => (
                            <CategoryCascadePicker
                              categories={categoryOptions}
                              value={field.value}
                              onSelect={field.onChange}
                              placeholder={t("placeholders.category")}
                              triggerClassName="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none hover:bg-transparent"
                              contentClassName="min-w-[16rem]"
                            />
                          )}
                        />
                        <FieldMessage error={form.formState.errors.category_id} />
                      </div>
                    </PickerRow>
                  ) : null}

                  {kind === "save_to_goal" || kind === "spend_from_goal" ? (
                    <PickerRow className="border-b-0">
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={form.control}
                          name="allocation_id"
                          render={({ field }) => (
                            <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                              <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none">
                                <span className={cn("truncate text-left", field.value ? "text-foreground" : "text-muted-foreground")}>
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

                  <RowShell label={t("fields.amount")}>
                    <div className="flex flex-col items-end gap-1">
                      <Controller
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <div className="flex items-center justify-end gap-2">
                            <DecimalInput
                              id="transaction-amount"
                              className="h-8 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right text-base leading-6 font-medium shadow-none"
                              hidePlaceholderOnFocus
                              value={field.value ?? null}
                              onValueChange={(value) => field.onChange(value ?? 0)}
                            />
                            <span className="text-sm text-foreground">{sourceCurrencySymbol}</span>
                          </div>
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
                            <div className="flex items-center justify-end gap-2">
                              <DecimalInput
                                id="transaction-destination-amount"
                                className="h-8 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right text-base leading-6 font-medium shadow-none"
                                hidePlaceholderOnFocus
                                value={field.value ?? null}
                                onValueChange={field.onChange}
                              />
                              <span className="text-sm text-foreground">{destinationCurrencySymbol}</span>
                            </div>
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
                              <DecimalInput
                                id="transaction-fx-rate"
                                className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none"
                                value={field.value ?? null}
                                onValueChange={field.onChange}
                              />
                          )}
                        />
                        <FieldMessage error={form.formState.errors.fx_rate} />
                      </div>
                    </RowShell>
                  ) : null}

                  {kind === "debt_payment" ? (
                    <>
                      <RowShell label={t("fields.principal")}>
                        <Controller
                          control={form.control}
                          name="principal_amount"
                            render={({ field }) => <DecimalInput id="transaction-principal" className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? null} onValueChange={field.onChange} />}
                          />
                      </RowShell>
                      <RowShell label={t("fields.interest")}>
                        <Controller
                          control={form.control}
                          name="interest_amount"
                            render={({ field }) => <DecimalInput id="transaction-interest" className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? null} onValueChange={field.onChange} />}
                          />
                      </RowShell>
                      <RowShell label={t("fields.extraPrincipal")}>
                        <Controller
                          control={form.control}
                          name="extra_principal_amount"
                            render={({ field }) => <DecimalInput id="transaction-extra-principal" className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none" value={field.value ?? null} onValueChange={field.onChange} />}
                          />
                      </RowShell>
                    </>
                  ) : null}

                  <SplitRow
                    rowClassName="pt-5"
                    left={
                      <Controller
                        control={form.control}
                        name="occurred_at"
                        render={({ field }) => (
                          <FlatDatePicker value={field.value} onChange={field.onChange} />
                        )}
                      />
                    }
                    right={
                      <Controller
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={mode === "edit-schedule"}>
                            <SelectTrigger
                              className={`h-auto w-auto rounded-full border-0 px-2.5 py-1 text-right text-[14px] font-medium shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0 data-[popup-open]:opacity-90 ${
                                field.value === "paid" ? "bg-emerald-50" : "bg-amber-50"
                              }`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full ${
                                  field.value === "paid" ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {field.value === "paid" ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                                <span>{field.value === "paid" ? t("status.paid") : t("status.planned")}</span>
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">{t("status.paid")}</SelectItem>
                              <SelectItem value="planned">{t("status.planned")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    }
                  >
                    <FieldMessage error={form.formState.errors.occurred_at} />
                    <FieldMessage error={form.formState.errors.status} />
                  </SplitRow>

                  {status === "planned" || mode === "edit-schedule" ? (
                    <>
                      <SplitRow
                        rowClassName="min-h-8 py-0 pt-4"
                        left={<span className="text-sm text-foreground">{t("fields.recurrenceFrequency")}</span>}
                        right={
                          <Controller
                            control={form.control}
                            name="recurrence_frequency"
                            render={({ field }) => (
                              <Select
                                value={mode === "edit-schedule" || isRecurring ? field.value : "never"}
                                onValueChange={(value) => {
                                  if (value === "never") {
                                    form.setValue("is_recurring", false, { shouldValidate: true });
                                    form.setValue("recurrence_until", null, { shouldValidate: true });
                                    return;
                                  }
                                  form.setValue("is_recurring", true, { shouldValidate: true });
                                  field.onChange(value);
                                }}
                              >
                                <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right shadow-none">
                                  <SelectValue className="capitalize" placeholder={t("recurrence.never")} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="never" className="capitalize">{t("recurrence.never")}</SelectItem>
                                  <SelectItem value="daily" className="capitalize">{t("recurrence.daily")}</SelectItem>
                                  <SelectItem value="weekly" className="capitalize">{t("recurrence.weekly")}</SelectItem>
                                  <SelectItem value="monthly" className="capitalize">{t("recurrence.monthly")}</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        }
                      />
                      {isRecurring || mode === "edit-schedule" ? (
                        <SplitRow
                          rowClassName="min-h-8 py-0 -mt-1"
                          left={<span className="text-sm text-foreground">{t("fields.recurrenceUntil")}</span>}
                          right={
                            <FlatDatePicker
                              value={recurrenceUntil ?? occurredAt}
                              onChange={(value) => form.setValue("recurrence_until", value, { shouldValidate: true })}
                              className="justify-end text-right"
                            />
                          }
                        >
                          <FieldMessage error={form.formState.errors.recurrence_until} />
                        </SplitRow>
                      ) : null}
                    </>
                  ) : null}

                  <PickerRow className={cn("pt-4", !note?.trim() && "border-b-0")}>
                    <Input id="transaction-note" className="h-10 w-full rounded-none border-0 bg-transparent px-0 py-1 text-base leading-7 shadow-none" placeholder={t("placeholders.note")} {...form.register("note")} />
                  </PickerRow>
                </FormBlock>
              )}
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
        </SheetContent>
      </Sheet>
  );
}
