"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Account, Allocation, Category, Transaction } from "@/types/finance";

type TransactionFormValues = import("@/types/finance-schemas").TransactionInput;
type TransactionFormInputs = import("@/types/finance-schemas").TransactionInputValues;

function isMoveKind(kind: Transaction["kind"]) {
  return kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal";
}

export function TransactionFormSheet({
  open,
  mode,
  transaction,
  initialKind,
  accounts,
  allocations,
  categories,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  transaction?: Transaction | null;
  initialKind?: Transaction["kind"];
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TransactionFormValues) => Promise<void> | void;
}) {
  const t = useTranslations("transactions.form");
  const kindsT = useTranslations("transactions.kinds");
  const transactionFormSchema = z
    .object({
      title: z.string().trim().min(1, t("validation.titleRequired")),
      note: z.string().trim().max(500, t("validation.noteMax")).nullable().optional(),
      occurred_at: z.string().trim().min(1, t("validation.dateRequired")),
      status: z.enum(["planned", "paid"]),
      kind: z.enum(["income", "expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment"]),
      amount: z.number().positive(t("validation.amountPositive")),
      destination_amount: z.number().positive(t("validation.destinationAmountPositive")).nullable().optional(),
      fx_rate: z.number().positive(t("validation.fxRatePositive")).nullable().optional(),
      principal_amount: z.number().min(0, t("validation.principalMin")).nullable().optional(),
      interest_amount: z.number().min(0, t("validation.interestMin")).nullable().optional(),
      extra_principal_amount: z.number().min(0, t("validation.extraMin")).nullable().optional(),
      category_id: z.string().uuid().nullable().optional(),
      source_account_id: z.string().uuid().nullable().optional(),
      destination_account_id: z.string().uuid().nullable().optional(),
      allocation_id: z.string().uuid().nullable().optional(),
    })
    .superRefine((values, ctx) => {
      const requireSource = values.kind === "expense" || values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" || values.kind === "debt_payment";
      const requireDestination = values.kind === "income" || values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" || values.kind === "debt_payment";
      const requireCategory = values.kind === "income" || values.kind === "expense";

      if (requireSource && !values.source_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_account_id"], message: t("validation.sourceRequired") });
      }
      if (requireDestination && !values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: t("validation.destinationRequired") });
      }
      if (requireCategory && !values.category_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: t("validation.categoryRequired") });
      }
      if (values.kind === "transfer" && values.category_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_id"], message: t("validation.transferNoCategory") });
      }
      if ((values.kind === "save_to_goal" || values.kind === "spend_from_goal") && !values.allocation_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocation_id"], message: t("validation.goalRequired") });
      }
      if (values.source_account_id && values.destination_account_id && values.source_account_id === values.destination_account_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_account_id"], message: t("validation.differentDestination") });
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
      if (requiresDestinationAmount && !values.destination_amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination_amount"], message: t("validation.destinationAmountRequired") });
      }
    })
    .transform((values) => ({
      ...values,
      note: values.note?.trim() ? values.note.trim() : null,
      destination_amount:
        values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal"
          ? values.destination_amount ?? values.amount
          : null,
      fx_rate: values.fx_rate ?? null,
      principal_amount: values.kind === "debt_payment" ? values.principal_amount ?? 0 : null,
      interest_amount: values.kind === "debt_payment" ? values.interest_amount ?? 0 : null,
      extra_principal_amount: values.kind === "debt_payment" ? values.extra_principal_amount ?? 0 : null,
      category_id: values.kind === "transfer" || values.kind === "save_to_goal" || values.kind === "spend_from_goal" ? null : values.category_id ?? null,
      allocation_id: values.kind === "save_to_goal" || values.kind === "spend_from_goal" ? values.allocation_id ?? null : null,
    }));
  const form = useForm<TransactionFormInputs, undefined, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      title: transaction?.title ?? "",
      note: transaction?.note ?? "",
      occurred_at: transaction?.occurred_at ?? new Date().toISOString().slice(0, 10),
      status: transaction?.status ?? "paid",
      kind: transaction?.kind ?? initialKind ?? "expense",
      amount: transaction?.amount ?? 0,
      destination_amount: transaction?.destination_amount ?? null,
      fx_rate: transaction?.fx_rate ?? null,
      principal_amount: transaction?.principal_amount ?? null,
      interest_amount: transaction?.interest_amount ?? null,
      extra_principal_amount: transaction?.extra_principal_amount ?? null,
      category_id: transaction?.category_id ?? null,
      source_account_id: transaction?.source_account_id ?? null,
      destination_account_id: transaction?.destination_account_id ?? null,
      allocation_id: transaction?.allocation_id ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      title: transaction?.title ?? "",
      note: transaction?.note ?? "",
      occurred_at: transaction?.occurred_at ?? new Date().toISOString().slice(0, 10),
      status: transaction?.status ?? "paid",
      kind: transaction?.kind ?? initialKind ?? "expense",
      amount: transaction?.amount ?? 0,
      destination_amount: transaction?.destination_amount ?? null,
      fx_rate: transaction?.fx_rate ?? null,
      principal_amount: transaction?.principal_amount ?? null,
      interest_amount: transaction?.interest_amount ?? null,
      extra_principal_amount: transaction?.extra_principal_amount ?? null,
      category_id: transaction?.category_id ?? null,
      source_account_id: transaction?.source_account_id ?? null,
      destination_account_id: transaction?.destination_account_id ?? null,
      allocation_id: transaction?.allocation_id ?? null,
    });
  }, [form, initialKind, open, transaction]);

  const kind = useWatch({ control: form.control, name: "kind" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const destinationAmount = useWatch({ control: form.control, name: "destination_amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate" });
  const sourceAccountId = useWatch({ control: form.control, name: "source_account_id" });
  const destinationAccountId = useWatch({ control: form.control, name: "destination_account_id" });

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
    if (isMoveKind(kind) && fxRate && amount) {
      form.setValue("destination_amount", Number((amount * fxRate).toFixed(2)), {
        shouldValidate: true,
      });
    }
  }, [amount, form, fxRate, kind]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? t("addTitle") : t("editTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="transaction-title">
                {t("fields.title")}
              </label>
              <Input id="transaction-title" {...form.register("title")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.kind")}</label>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full bg-white">
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

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.status")}</label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full bg-white">
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="transaction-date">
                {t("fields.date")}
              </label>
              <Input id="transaction-date" type="date" {...form.register("occurred_at")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(kind === "expense" || kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal" || kind === "debt_payment") ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("fields.sourceAccount")}</label>
                  <Controller
                    control={form.control}
                    name="source_account_id"
                    render={({ field }) => (
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full bg-white">
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
                </div>
              ) : null}

              {(kind === "income" || kind === "transfer" || kind === "save_to_goal" || kind === "spend_from_goal" || kind === "debt_payment") ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("fields.destinationAccount")}</label>
                  <Controller
                    control={form.control}
                    name="destination_account_id"
                    render={({ field }) => (
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full bg-white">
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
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transaction-amount">
                  {t("fields.amount")}
                </label>
                <Input
                  id="transaction-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("amount", { setValueAs: (value) => Number(value) })}
                />
              </div>

              {isMoveKind(kind) ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="transaction-destination-amount">
                    {t("fields.destinationAmount")}
                  </label>
                  <Input
                    id="transaction-destination-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={destinationAmount ?? ""}
                    onChange={(event) => form.setValue("destination_amount", event.target.value === "" ? null : Number(event.target.value), { shouldValidate: true })}
                  />
                </div>
              ) : null}
            </div>

            {isMoveKind(kind) ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transaction-fx-rate">
                  {t("fields.fxRate")}
                </label>
                <Input
                  id="transaction-fx-rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={fxRate ?? ""}
                  onChange={(event) => form.setValue("fx_rate", event.target.value === "" ? null : Number(event.target.value), { shouldValidate: true })}
                />
              </div>
            ) : null}

            {(kind === "income" || kind === "expense" || kind === "debt_payment") ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.category")}</label>
                <Controller
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={t("placeholders.category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <span>{category.icon ?? "•"}</span>
                            <span>{category.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {(kind === "save_to_goal" || kind === "spend_from_goal") ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.savingsGoal")}</label>
                <Controller
                  control={form.control}
                  name="allocation_id"
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={t("placeholders.goal")} />
                      </SelectTrigger>
                      <SelectContent>
                        {goalOptions.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {goal.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            {kind === "debt_payment" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="transaction-principal">
                    {t("fields.principal")}
                  </label>
                  <Input
                    id="transaction-principal"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("principal_amount", { setValueAs: (value) => (value === "" ? null : Number(value)) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="transaction-interest">
                    {t("fields.interest")}
                  </label>
                  <Input
                    id="transaction-interest"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("interest_amount", { setValueAs: (value) => (value === "" ? null : Number(value)) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="transaction-extra">
                    {t("fields.extraPrincipal")}
                  </label>
                  <Input
                    id="transaction-extra"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("extra_principal_amount", { setValueAs: (value) => (value === "" ? null : Number(value)) })}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="transaction-note">
                {t("fields.note")}
              </label>
              <textarea
                id="transaction-note"
                className="min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...form.register("note")}
              />
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" className="w-full">
              {mode === "add" ? t("submit.add") : t("submit.edit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
