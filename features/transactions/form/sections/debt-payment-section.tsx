"use client";

import { useEffect, useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { FieldMessage, FormPickerRow, FormRow, FormSection } from "@/components/form-primitives";
import { MoneyInput } from "@/components/money-input";
import { cn } from "@/lib/utils";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { SharedFields } from "./shared-fields";
import { normalizeDebtPaymentBreakdown } from "../debt-payment-breakdown";
import type { TransactionFormInputs } from "../types";

export function DebtPaymentSection() {
  const t = useTranslations("transactions.form");
  const { accounts, categoryOptions, sourceCurrencySymbol } = useTransactionFormContext();
  const { control, watch, setValue, formState: { dirtyFields, errors } } = useFormContext<TransactionFormInputs>();
  const sourceAccountId = watch("source_account_id");
  const destinationAccountId = watch("destination_account_id");
  const amount = watch("amount");
  const principal = watch("principal_amount") ?? 0;
  const interest = watch("interest_amount") ?? 0;
  const extra = watch("extra_principal_amount") ?? 0;
  const breakdownSum = principal + interest + extra;
  const breakdownDiff = Math.abs(breakdownSum - amount);
  const breakdownOk = breakdownSum > 0 && breakdownDiff <= 0.01;
  const principalDirty = Boolean(dirtyFields.principal_amount);
  const interestDirty = Boolean(dirtyFields.interest_amount);
  const extraDirty = Boolean(dirtyFields.extra_principal_amount);
  const sourceAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "credit_card" && account.type !== "debt"),
    [accounts],
  );
  const destinationAccounts = useMemo(
    () => accounts.filter((account) => account.type === "debt" || account.type === "credit_card"),
    [accounts],
  );

  useEffect(() => {
    if (sourceAccountId && sourceAccounts.some((account) => account.id === sourceAccountId)) return;
    const nextSourceAccountId = sourceAccounts[0]?.id ?? null;
    if (sourceAccountId === nextSourceAccountId) return;
    setValue("source_account_id", nextSourceAccountId, { shouldValidate: false });
  }, [setValue, sourceAccountId, sourceAccounts]);

  useEffect(() => {
    if (destinationAccountId && destinationAccounts.some((account) => account.id === destinationAccountId)) return;
    const nextDestinationAccountId = destinationAccounts[0]?.id ?? null;
    if (destinationAccountId === nextDestinationAccountId) return;
    setValue("destination_account_id", nextDestinationAccountId, { shouldValidate: false });
  }, [destinationAccountId, destinationAccounts, setValue]);

  useEffect(() => {
    const dirtyCount = Number(principalDirty) + Number(interestDirty) + Number(extraDirty);

    if (amount <= 0 || dirtyCount === 0 || dirtyCount === 3) return;

    const breakdown = normalizeDebtPaymentBreakdown({
      amount,
      principal_amount: principalDirty ? principal : null,
      interest_amount: interestDirty ? interest : null,
      extra_principal_amount: extraDirty ? extra : null,
    });

    if (!breakdown) return;

    if (!principalDirty) {
      setValue("principal_amount", breakdown.principal_amount, { shouldValidate: true, shouldDirty: false });
    }
    if (!interestDirty) {
      setValue("interest_amount", breakdown.interest_amount, { shouldValidate: true, shouldDirty: false });
    }
    if (!extraDirty) {
      setValue("extra_principal_amount", breakdown.extra_principal_amount, { shouldValidate: true, shouldDirty: false });
    }
  }, [amount, extra, extraDirty, interest, interestDirty, principal, principalDirty, setValue]);

  return (
    <FormSection>
      <FormPickerRow>
        <AccountSelect name="source_account_id" accounts={sourceAccounts} placeholder={t("placeholders.sourceAccount")} />
      </FormPickerRow>

      <FormPickerRow>
        <AccountSelect name="destination_account_id" accounts={destinationAccounts} placeholder={t("placeholders.destinationAccount")} />
      </FormPickerRow>

      <FormPickerRow>
        <div className="flex flex-col gap-1">
          <Controller
            control={control}
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
          <FieldMessage error={errors.category_id} />
        </div>
      </FormPickerRow>

      <FormRow label={t("fields.amount")}>
        <div className="flex flex-col items-end gap-1">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <div className="flex items-center justify-end gap-2">
                <MoneyInput
                  id="transaction-amount"
                  autoComplete="off"
                  className="type-h3 h-10 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right shadow-none"
                  blankZeroOnFocus
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value ?? 0)}
                />
                <span className="type-h5 text-muted-foreground">{sourceCurrencySymbol}</span>
              </div>
            )}
          />
          <FieldMessage error={errors.amount} />
        </div>
      </FormRow>

      {/* Breakdown rows */}
      <FormRow label={t("fields.principal")}>
        <Controller
          control={control}
          name="principal_amount"
          render={({ field }) => (
            <MoneyInput
              id="transaction-principal"
              autoComplete="off"
              className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none"
              value={field.value ?? null}
              onValueChange={field.onChange}
            />
          )}
        />
      </FormRow>
      <FormRow label={t("fields.interest")}>
        <Controller
          control={control}
          name="interest_amount"
          render={({ field }) => (
            <MoneyInput
              id="transaction-interest"
              autoComplete="off"
              className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none"
              value={field.value ?? null}
              onValueChange={field.onChange}
            />
          )}
        />
      </FormRow>
      <FormRow label={t("fields.extraPrincipal")}>
        <Controller
          control={control}
          name="extra_principal_amount"
          render={({ field }) => (
            <MoneyInput
              id="transaction-extra-principal"
              autoComplete="off"
              className="h-auto w-[8rem] rounded-none border-0 bg-transparent px-0 py-0 text-right shadow-none"
              value={field.value ?? null}
              onValueChange={field.onChange}
            />
          )}
        />
      </FormRow>

      {/* Live breakdown validation bar */}
      {breakdownSum > 0 && (
        <div
          className={cn(
            "flex items-center justify-between px-0 py-2 text-xs",
            breakdownOk
              ? "text-muted-foreground"
              : "text-destructive",
          )}
        >
          <span>
            {principal.toFixed(2)} + {interest.toFixed(2)} + {extra.toFixed(2)} ={" "}
            <strong>{breakdownSum.toFixed(2)}</strong>
          </span>
          <span>{breakdownOk ? "✓" : `≠ ${amount?.toFixed(2) ?? "–"}`}</span>
        </div>
      )}
      <FieldMessage error={errors.principal_amount} />

      <SharedFields />
    </FormSection>
  );
}
