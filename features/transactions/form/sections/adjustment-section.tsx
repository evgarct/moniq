"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { DecimalInput, FieldMessage, FormBlock, PickerRow, RowShell, SplitRow, FlatDatePicker } from "../primitives";
import type { TransactionFormInputs } from "../types";

export function AdjustmentSection() {
  const t = useTranslations("transactions.form");
  const { accounts, accountById, sourceAccountId } = useTransactionFormContext();
  const { control, register, setValue, watch, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const note = watch("note");

  const account = accountById.get(sourceAccountId ?? "");
  const symbol = getCurrencySymbol(account?.currency ?? "EUR");
  const currentBalance = account?.balance ?? 0;
  const targetBalance = watch("adjustment_target_balance");
  const diff = targetBalance != null ? targetBalance - currentBalance : null;

  return (
    <FormBlock>
      <PickerRow className="border-b-0 pt-4">
        <AccountSelect
          name="source_account_id"
          accounts={accounts}
          placeholder={t("placeholders.adjustmentAccount")}
          onChange={() => setValue("adjustment_target_balance", null)}
        />
      </PickerRow>

      {account ? (
        <>
          <RowShell label={t("fields.currentBalance")}>
            <span className="tabular-nums text-sm text-muted-foreground">
              {currentBalance.toFixed(2)} {symbol}
            </span>
          </RowShell>

          <RowShell label={t("fields.newBalance")}>
            <div className="flex flex-col items-end gap-1">
              <Controller
                control={control}
                name="adjustment_target_balance"
                render={({ field }) => (
                  <div className="flex items-center justify-end gap-2">
                    <DecimalInput
                      id="adjustment-target-balance"
                      className="h-8 w-[11rem] rounded-none border-0 bg-transparent px-0 py-1 text-right text-base leading-6 font-medium shadow-none"
                      hidePlaceholderOnFocus
                      placeholder="0.00"
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                    />
                    <span className="text-sm text-foreground">{symbol}</span>
                  </div>
                )}
              />
              <FieldMessage error={errors.adjustment_target_balance} />
            </div>
          </RowShell>

          {diff != null && Math.abs(diff) >= 0.001 ? (
            <RowShell label={t("fields.adjustmentDiff")}>
              <span className={cn("tabular-nums text-sm font-medium", diff > 0 ? "text-emerald-600" : "text-destructive")}>
                {diff > 0 ? "+" : ""}
                {diff.toFixed(2)} {symbol}
              </span>
            </RowShell>
          ) : null}
        </>
      ) : null}

      <SplitRow
        rowClassName="pt-5"
        left={
          <Controller
            control={control}
            name="occurred_at"
            render={({ field }) => <FlatDatePicker value={field.value} onChange={field.onChange} />}
          />
        }
        right={null}
      >
        <FieldMessage error={errors.occurred_at} />
      </SplitRow>

      <div className={cn("min-h-11 border-b border-border/70 py-2 pt-4", !note?.trim() && "border-b-0")}>
        <input
          id="transaction-note"
          className="h-10 w-full rounded-none border-0 bg-transparent px-0 py-1 text-base leading-7 shadow-none outline-none focus:outline-none"
          placeholder={t("placeholders.note")}
          {...register("note")}
        />
        <FieldMessage error={errors.note} />
      </div>
    </FormBlock>
  );
}
