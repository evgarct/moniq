"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";

import { CategoryCascadePicker } from "@/components/category-cascade-picker";
import { FieldMessage, FormPickerRow, FormRow, FormSection } from "@/components/form-primitives";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { isInvestmentCategory } from "@/features/categories/lib/category-tree";

import { useTransactionFormContext } from "../context";
import { AccountSelect } from "../account-select";
import { getGoalAllocationsForSource, GoalSelect } from "../goal-select";
import { SharedFields } from "./shared-fields";
import { BatchItemsSection } from "./batch-items-section";
import type { TransactionFormInputs } from "../types";

export function ExpenseSection() {
  const t = useTranslations("transactions.form");
  const { form, isBatchMode, isRecurring, accounts, categories, categoryOptions, sourceAccountId, sourceCurrencySymbol, allocations, investmentPositions } = useTransactionFormContext();
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const categoryId = useWatch({ control, name: "category_id" });
  const lineItems = useWatch({ control, name: "line_items" });
  const investmentInstrumentId = useWatch({ control, name: "investment_instrument_id" });
  const investmentCategoryId = isBatchMode && lineItems.length === 1 ? lineItems[0]?.category_id : categoryId;
  const savingAllocations = getGoalAllocationsForSource(accounts, allocations, sourceAccountId);
  const etfPositions = investmentPositions.filter((position) => position.instrument.type === "etf");
  const showInvestmentPurchase = !isRecurring && etfPositions.length > 0 && isInvestmentCategory(categories, investmentCategoryId);

  const investmentFields = showInvestmentPurchase ? (
    <>
      <FormRow label={t("fields.investment")}>
        <Controller
          control={control}
          name="investment_instrument_id"
          render={({ field }) => (
            <Select
              value={field.value ?? "none"}
              onValueChange={(value) => {
                if (isBatchMode && value !== "none") {
                  const lineItem = form.getValues("line_items.0");
                  form.setValue("category_id", lineItem.category_id, { shouldDirty: true });
                  form.setValue("amount", lineItem.amount ?? 0, { shouldDirty: true });
                  form.setValue("note", lineItem.note ?? "", { shouldDirty: true });
                }
                field.onChange(value === "none" ? null : value);
                if (value === "none") form.setValue("investment_units", null, { shouldDirty: true });
              }}
            >
              <SelectTrigger className="h-auto min-w-44 justify-end border-0 bg-transparent px-0 py-0 shadow-none">
                {field.value
                  ? etfPositions.find((position) => position.instrument_id === field.value)?.instrument.ticker
                  : t("placeholders.investment")}
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">{t("placeholders.investment")}</SelectItem>
                  {etfPositions.map((position) => (
                    <SelectItem key={position.instrument_id} value={position.instrument_id}>
                      {position.instrument.ticker} · {position.instrument.exchange}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
      </FormRow>
      {investmentInstrumentId ? (
        <FormRow label={t("fields.investmentUnits")}>
          <Controller
            control={control}
            name="investment_units"
            render={({ field }) => (
              <Input
                className="w-44 border-0 text-right shadow-none"
                inputMode="decimal"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormRow>
      ) : null}
    </>
  ) : null;

  if (isBatchMode) {
    return (
      <FormSection>
        <BatchItemsSection />
        {savingAllocations.length > 0 && (
          <FormPickerRow>
            <GoalSelect allocations={savingAllocations} />
          </FormPickerRow>
        )}
        {investmentFields}
        <SharedFields />
      </FormSection>
    );
  }

  return (
    <FormSection>
      <FormPickerRow>
        <AccountSelect name="source_account_id" accounts={accounts} placeholder={t("placeholders.sourceAccount")} />
      </FormPickerRow>

      {savingAllocations.length > 0 && (
        <FormPickerRow>
          <GoalSelect allocations={savingAllocations} />
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

      {investmentFields}

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
