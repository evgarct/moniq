"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";

import { getCurrencySymbol } from "@/lib/formatters";
import type { Account, Allocation, Category, Transaction, TransactionSchedule } from "@/types/finance";

import { buildSchema } from "./schema";
import { supportsBatchItems, isMoveKind, createEmptyLineItem } from "./helpers";
import type {
  TransactionFormInputs,
  TransactionFormMode,
  TransactionFormSubmitPayload,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionFormContextValue = {
  form: UseFormReturn<TransactionFormInputs>;
  mode: TransactionFormMode;
  open: boolean;
  // data
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  transactions: Transaction[];
  // callbacks
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  // derived
  kind: Transaction["kind"];
  isRecurring: boolean;
  occurredAt: string;
  status: "planned" | "paid";
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  note: string;
  isBatchMode: boolean;
  sourceAccount: Account | undefined;
  destinationAccount: Account | undefined;
  sourceCurrencySymbol: string;
  destinationCurrencySymbol: string;
  primaryCurrencySymbol: string;
  categoryOptions: Category[];
  goalOptions: Allocation[];
  accountById: Map<string, Account>;
  accountNameById: Map<string, string>;
  goalNameById: Map<string, string>;
  // field array
  fields: ReturnType<typeof useFieldArray<TransactionFormInputs, "line_items">>["fields"];
  append: ReturnType<typeof useFieldArray<TransactionFormInputs, "line_items">>["append"];
  insert: ReturnType<typeof useFieldArray<TransactionFormInputs, "line_items">>["insert"];
  remove: ReturnType<typeof useFieldArray<TransactionFormInputs, "line_items">>["remove"];
  replace: ReturnType<typeof useFieldArray<TransactionFormInputs, "line_items">>["replace"];
  // line menu
  lineMenu: { index: number; x: number; y: number } | null;
  setLineMenu: (menu: { index: number; x: number; y: number } | null) => void;
  lineMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  // refs
  amountInputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  lineTriggerRefs: React.MutableRefObject<Record<number, HTMLButtonElement | null>>;
  // actions
  appendLineItem: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const TransactionFormCtx = createContext<TransactionFormContextValue | null>(null);

export function useTransactionFormContext() {
  const ctx = useContext(TransactionFormCtx);
  if (!ctx) throw new Error("useTransactionFormContext must be used inside TransactionFormProvider");
  return ctx;
}

// ─── Default values ───────────────────────────────────────────────────────────

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
  const eligibleIds = new Set(accounts.map((a) => a.id));
  const usage = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    const id = role === "source" ? tx.source_account_id : tx.destination_account_id;
    if (!id || !eligibleIds.has(id)) continue;
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return [...usage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function makeDefaults({
  transaction,
  schedule,
  initialKind,
  initialDate,
  mode,
  defaultSourceAccountId,
}: {
  transaction?: Transaction | null;
  schedule?: TransactionSchedule | null;
  initialKind?: Transaction["kind"];
  initialDate?: string | null;
  mode: TransactionFormMode;
  defaultSourceAccountId?: string | null;
}): TransactionFormInputs {
  const currentKind = schedule?.kind ?? transaction?.kind ?? initialKind ?? "expense";
  const isAddMode = mode === "add";
  const incomeKinds = new Set<Transaction["kind"]>(["income", "save_to_goal"]);
  const defaultSourceId = isAddMode && defaultSourceAccountId && !incomeKinds.has(currentKind) ? defaultSourceAccountId : null;
  const defaultDestId = isAddMode && defaultSourceAccountId && incomeKinds.has(currentKind) ? defaultSourceAccountId : null;
  return {
    title: schedule?.title ?? transaction?.title ?? "",
    note: schedule?.note ?? transaction?.note ?? "",
    occurred_at: schedule?.start_date ?? transaction?.occurred_at ?? initialDate ?? format(new Date(), "yyyy-MM-dd"),
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
    adjustment_target_balance: null,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TransactionFormProvider({
  children,
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
  onSubmit,
  onOpenChange,
}: {
  children: React.ReactNode;
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
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("transactions.form");
  const schema = useMemo(
    () =>
      buildSchema(
        {
          validation: {
            noteMax: t("validation.noteMax"),
            dateRequired: t("validation.dateRequired"),
            amountPositive: t("validation.amountPositive"),
            destinationAmountPositive: t("validation.destinationAmountPositive"),
            fxRatePositive: t("validation.fxRatePositive"),
            principalMin: t("validation.principalMin"),
            interestMin: t("validation.interestMin"),
            extraMin: t("validation.extraMin"),
            sourceRequired: t("validation.sourceRequired"),
            destinationRequired: t("validation.destinationRequired"),
            categoryRequired: t("validation.categoryRequired"),
            goalRequired: t("validation.goalRequired"),
            differentDestination: t("validation.differentDestination"),
            debtBreakdownRequired: t("validation.debtBreakdownRequired"),
            debtBreakdownMismatch: t("validation.debtBreakdownMismatch"),
            destinationAmountRequired: t("validation.destinationAmountRequired"),
            lineItemsRequired: t("validation.lineItemsRequired"),
            recurringMustBePlanned: t("validation.recurringMustBePlanned"),
            recurrenceUntilBeforeStart: t("validation.recurrenceUntilBeforeStart"),
            adjustmentBalanceRequired: t("validation.adjustmentBalanceRequired"),
            adjustmentNoDiff: t("validation.adjustmentNoDiff"),
          },
        },
        mode,
      ),
    [mode, t],
  );

  const form = useForm<TransactionFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: makeDefaults({ transaction, schedule, initialKind, initialDate, mode, defaultSourceAccountId }),
  });

  const { fields, append, insert, remove, replace } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  useEffect(() => {
    form.reset(makeDefaults({ transaction, schedule, initialKind, initialDate, mode, defaultSourceAccountId }));
  }, [form, initialKind, initialDate, mode, open, schedule, transaction, defaultSourceAccountId]);

  const kind = useWatch({ control: form.control, name: "kind" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate" });
  const isRecurring = useWatch({ control: form.control, name: "is_recurring" });
  const sourceAccountId = useWatch({ control: form.control, name: "source_account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });
  const occurredAt = useWatch({ control: form.control, name: "occurred_at" });
  const status = useWatch({ control: form.control, name: "status" });
  const note = useWatch({ control: form.control, name: "note" });

  const isBatchMode = mode === "add" && supportsBatchItems(kind);

  // auto-calc destination amount from fx rate
  useEffect(() => {
    if (isMoveKind(kind) && fxRate && amount) {
      form.setValue("destination_amount", Number((amount * fxRate).toFixed(2)), { shouldValidate: true });
    }
  }, [amount, form, fxRate, kind]);

  // auto-set status based on date (add mode only)
  useEffect(() => {
    if (mode !== "add") return;
    const today = format(new Date(), "yyyy-MM-dd");
    const nextStatus =
      isBefore(startOfDay(parseISO(occurredAt)), startOfDay(new Date())) || occurredAt === today
        ? "paid"
        : "planned";
    form.setValue("status", nextStatus, { shouldValidate: true });
  }, [form, mode, occurredAt]);

  // disable recurring when status becomes paid
  useEffect(() => {
    if (mode === "edit-schedule") return;
    if (status === "paid") {
      form.setValue("is_recurring", false, { shouldValidate: true });
    }
  }, [form, mode, status]);

  // ensure at least one line item in batch mode
  useEffect(() => {
    if (isBatchMode && !fields.length) {
      replace([createEmptyLineItem()]);
    }
  }, [fields.length, isBatchMode, replace]);

  // smart account defaults on open (add mode)
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
    if (
      ["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "investment", "adjustment"].includes(kind) &&
      !sourceAccountId
    ) {
      form.setValue("source_account_id", mostUsedSourceAccountId ?? accounts[0]?.id ?? null, {
        shouldValidate: false,
      });
    }
    if (
      ["income", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "refund"].includes(kind) &&
      !destinationAccountId
    ) {
      form.setValue("destination_account_id", mostUsedDestinationAccountId ?? accounts[0]?.id ?? null, {
        shouldValidate: false,
      });
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

  // line menu state
  const [lineMenu, setLineMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const lineMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lineMenu) return;
    const close = (e: PointerEvent) => {
      if (lineMenuRef.current?.contains(e.target as Node)) return;
      setLineMenu(null);
    };
    const closeImmediate = () => setLineMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", closeImmediate, true);
    window.addEventListener("resize", closeImmediate);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", closeImmediate, true);
      window.removeEventListener("resize", closeImmediate);
    };
  }, [lineMenu]);

  // refs
  const amountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const lineTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appendLineItem = () => {
    append(createEmptyLineItem());
    setTimeout(() => {
      const nextIndex = fields.length;
      lineTriggerRefs.current[nextIndex]?.click();
    }, 0);
  };

  // derived
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const goalNameById = useMemo(() => new Map(allocations.map((a) => [a.id, a.name])), [allocations]);
  const sourceAccount = accountById.get(sourceAccountId ?? "");
  const destinationAccount = accountById.get(destinationAccountId ?? "");
  const selectedType: "income" | "expense" = kind === "income" ? "income" : "expense";
  const categoryOptions = categories.filter((c) => c.type === selectedType);
  const goalOptions = allocations.filter((a) => {
    if (kind === "save_to_goal") return a.account_id === destinationAccountId;
    if (kind === "spend_from_goal") return a.account_id === sourceAccountId;
    return true;
  });
  const primaryBatchAccount =
    kind === "income" ? accountById.get(destinationAccountId ?? "") : accountById.get(sourceAccountId ?? "");
  const primaryCurrencySymbol = getCurrencySymbol(primaryBatchAccount?.currency ?? "EUR");
  const sourceCurrencySymbol = getCurrencySymbol(sourceAccount?.currency ?? "EUR");
  const destinationCurrencySymbol = getCurrencySymbol(
    destinationAccount?.currency ?? sourceAccount?.currency ?? "EUR",
  );

  // expose longPressTimerRef for batch section
  (appendLineItem as unknown as { longPressRef: typeof longPressTimerRef }).longPressRef = longPressTimerRef;

  const value: TransactionFormContextValue = {
    form,
    mode,
    open,
    accounts,
    allocations,
    categories,
    transactions,
    onSubmit,
    onOpenChange,
    kind,
    isRecurring,
    occurredAt,
    status: status as "planned" | "paid",
    sourceAccountId: sourceAccountId ?? null,
    destinationAccountId: destinationAccountId ?? null,
    note: note ?? "",
    isBatchMode,
    sourceAccount,
    destinationAccount,
    sourceCurrencySymbol,
    destinationCurrencySymbol,
    primaryCurrencySymbol,
    categoryOptions,
    goalOptions,
    accountById,
    accountNameById,
    goalNameById,
    fields,
    append,
    insert,
    remove,
    replace,
    lineMenu,
    setLineMenu,
    lineMenuRef,
    amountInputRefs,
    lineTriggerRefs,
    appendLineItem,
  };

  return (
    <FormProvider {...form}>
      <TransactionFormCtx.Provider value={value}>
        {children}
      </TransactionFormCtx.Provider>
    </FormProvider>
  );
}
