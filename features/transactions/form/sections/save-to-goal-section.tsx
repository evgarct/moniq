"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { DecimalInput, FieldMessage, FormBlock, PickerRow, RowShell } from "../primitives";
import { toSelectValue } from "../helpers";
import { SharedFields } from "./shared-fields";
import { BatchItemsSection } from "./batch-items-section";
import type { TransactionFormInputs } from "../types";

export function SaveToGoalSection() {
  const t = useTranslations("transactions.form");
  const {
    isBatchMode,
    accounts,
    goalOptions,
    goalNameById,
    sourceCurrencySymbol,
    destinationCurrencySymbol,
  } = useTransactionFormContext();
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();

  if (isBatchMode) {
    return (
      <FormBlock>
        <BatchItemsSection />
        <SharedFields />
      </FormBlock>
    );
  }

  return (
    <FormBlock>
      <PickerRow className="border-b-0 pt-4">
        <AccountSelect name="source_account_id" accounts={accounts} placeholder={t("placeholders.sourceAccount")} />
      </PickerRow>

      <PickerRow className="border-b-0">
        <AccountSelect name="destination_account_id" accounts={accounts} placeholder={t("placeholders.destinationAccount")} />
      </PickerRow>

      <PickerRow className="border-b-0">
        <div className="flex flex-col gap-1">
          <Controller
            control={control}
            name="allocation_id"
            render={({ field }) => (
              <Select value={toSelectValue(field.value)} onValueChange={field.onChange}>
                <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none">
                  <span className={cn("truncate text-left", field.value ? "text-foreground" : "text-muted-foreground")}>
                    {field.value ? (goalNameById.get(field.value) ?? field.value) : t("placeholders.goal")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {goalOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldMessage error={errors.allocation_id} />
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

      <RowShell label={t("fields.destinationAmount")}>
        <div className="flex flex-col items-end gap-1">
          <Controller
            control={control}
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
          <FieldMessage error={errors.destination_amount} />
        </div>
      </RowShell>

      <RowShell label={t("fields.fxRate")}>
        <div className="flex flex-col items-end gap-1">
          <Controller
            control={control}
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
          <FieldMessage error={errors.fx_rate} />
        </div>
      </RowShell>

      <SharedFields />
    </FormBlock>
  );
}
