"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { DecimalInput, FieldMessage, FormBlock, PickerRow, RowShell } from "../primitives";
import { SharedFields } from "./shared-fields";
import type { TransactionFormInputs } from "../types";

export function RefundSection() {
  const t = useTranslations("transactions.form");
  const { accounts, categoryOptions, sourceCurrencySymbol } = useTransactionFormContext();
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();

  return (
    <FormBlock>
      <PickerRow className="border-b-0 pt-4">
        <AccountSelect name="destination_account_id" accounts={accounts} placeholder={t("placeholders.destinationAccount")} />
      </PickerRow>

      <PickerRow className="border-b-0">
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
      </PickerRow>

      <RowShell label={t("fields.amount")}>
        <div className="flex flex-col items-end gap-1">
          <Controller
            control={control}
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
          <FieldMessage error={errors.amount} />
        </div>
      </RowShell>

      <SharedFields />
    </FormBlock>
  );
}
