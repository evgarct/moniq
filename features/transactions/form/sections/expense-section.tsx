"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { FieldMessage, FormPickerRow, FormRow, FormSection } from "@/components/form-primitives";
import { MoneyInput } from "@/components/money-input";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { GoalSelect } from "../goal-select";
import { SharedFields } from "./shared-fields";
import { BatchItemsSection } from "./batch-items-section";
import type { TransactionFormInputs } from "../types";

export function ExpenseSection() {
  const t = useTranslations("transactions.form");
  const { isBatchMode, accounts, categoryOptions, sourceCurrencySymbol, allocations } = useTransactionFormContext();
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();

  if (isBatchMode) {
    return (
      <FormSection>
        <BatchItemsSection />
        {allocations.length > 0 && (
          <FormPickerRow>
            <GoalSelect allocations={allocations} />
          </FormPickerRow>
        )}
        <SharedFields />
      </FormSection>
    );
  }

  return (
    <FormSection>
      <FormPickerRow>
        <AccountSelect name="source_account_id" accounts={accounts} placeholder={t("placeholders.sourceAccount")} />
      </FormPickerRow>

      {allocations.length > 0 && (
        <FormPickerRow>
          <GoalSelect allocations={allocations} />
        </FormPickerRow>
      )}

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

      <SharedFields />
    </FormSection>
  );
}
