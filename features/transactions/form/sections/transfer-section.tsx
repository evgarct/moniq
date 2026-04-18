"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { DecimalInput, FieldMessage, FormBlock, PickerRow, RowShell } from "../primitives";
import { SharedFields } from "./shared-fields";
import type { TransactionFormInputs } from "../types";

export function TransferSection() {
  const t = useTranslations("transactions.form");
  const { accounts, sourceCurrencySymbol, destinationCurrencySymbol } = useTransactionFormContext();
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();

  return (
    <FormBlock>
      <PickerRow className="border-b-0 pt-4">
        <AccountSelect name="source_account_id" accounts={accounts} placeholder={t("placeholders.sourceAccount")} />
      </PickerRow>

      <PickerRow className="border-b-0">
        <AccountSelect name="destination_account_id" accounts={accounts} placeholder={t("placeholders.destinationAccount")} />
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
