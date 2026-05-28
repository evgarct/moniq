"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { FieldMessage, FormPickerRow, FormRow, FormSection } from "@/components/form-primitives";
import { MoneyInput } from "@/components/money-input";
import { cn } from "@/lib/utils";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { SharedFields } from "./shared-fields";
import type { TransactionFormInputs } from "../types";

export function DebtPaymentSection() {
  const t = useTranslations("transactions.form");
  const { accounts, categoryOptions, sourceCurrencySymbol } = useTransactionFormContext();
  const { control, watch, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const amount = watch("amount");
  const principal = watch("principal_amount") ?? 0;
  const interest = watch("interest_amount") ?? 0;
  const extra = watch("extra_principal_amount") ?? 0;
  const breakdownSum = principal + interest + extra;
  const breakdownDiff = Math.abs(breakdownSum - amount);
  const breakdownOk = breakdownSum > 0 && breakdownDiff <= 0.01;

  return (
    <FormSection>
      <FormPickerRow className="border-b-0 pt-4">
        <AccountSelect name="source_account_id" accounts={accounts} placeholder={t("placeholders.sourceAccount")} />
      </FormPickerRow>

      <FormPickerRow className="border-b-0">
        <AccountSelect name="destination_account_id" accounts={accounts} placeholder={t("placeholders.destinationAccount")} />
      </FormPickerRow>

      <FormPickerRow className="border-b-0">
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
                  className="h-8 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right text-base leading-6 font-medium shadow-none"
                  blankZeroOnFocus
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value ?? 0)}
                />
                <span className="text-sm text-foreground">{sourceCurrencySymbol}</span>
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
            "flex items-center justify-between border-t border-border/70 px-0 py-2 text-xs",
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
