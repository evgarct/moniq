"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FlatDatePicker, FieldMessage, FormPickerRow, FormSplitRow } from "@/components/form-primitives";

import { useTransactionFormContext } from "../context";
import type { TransactionFormInputs } from "../types";

export function SharedFields({
  showStatus = true,
  showRecurrence = true,
}: {
  showStatus?: boolean;
  showRecurrence?: boolean;
}) {
  const t = useTranslations("transactions.form");
  const { mode, isRecurring, occurredAt, status } = useTransactionFormContext();
  const { control, register, setValue, watch, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const recurrenceUntil = watch("recurrence_until");
  const recurrenceFrequency = watch("recurrence_frequency");
  const recurrenceIntervalCount = watch("recurrence_interval_count");

  const showRecurrenceSection =
    showRecurrence && (status === "planned" || mode === "edit-schedule");

  return (
    <>
      <FormSplitRow
        rowClassName="mt-2"
        left={
          <Controller
            control={control}
            name="occurred_at"
            render={({ field }) => <FlatDatePicker value={field.value} onChange={field.onChange} />}
          />
        }
        right={
          showStatus ? (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <ToggleGroup
                  value={[field.value]}
                  onValueChange={(value) => {
                    const next = value[0];
                    if (next === "planned" || next === "paid") field.onChange(next);
                  }}
                  disabled={mode === "edit-schedule"}
                  variant="outline"
                  size="sm"
                  aria-label={t("fields.status")}
                >
                  <ToggleGroupItem value="planned" aria-label={t("status.planned")}>
                    <Clock3 data-icon="inline-start" />
                    {t("status.planned")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="paid" aria-label={t("status.paid")}>
                    <CheckCircle2 data-icon="inline-start" />
                    {t("status.paid")}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
          ) : null
        }
      >
        <FieldMessage error={errors.occurred_at} />
        <FieldMessage error={errors.status} />
      </FormSplitRow>

      {showRecurrenceSection ? (
        <>
          <FormSplitRow
            rowClassName="min-h-10 pt-4"
            left={<span className="type-body-14 text-foreground">{t("fields.recurrenceFrequency")}</span>}
            right={
              <Controller
                control={control}
                name="recurrence_frequency"
                render={({ field }) => (
                  <Select
                    value={mode === "edit-schedule" || isRecurring ? field.value : "never"}
                    onValueChange={(value) => {
                      if (value === "never") {
                        setValue("is_recurring", false, { shouldValidate: true });
                        setValue("recurrence_until", null, { shouldValidate: true });
                        return;
                      }
                      setValue("is_recurring", true, { shouldValidate: true });
                      field.onChange(value);
                    }}
                  >
                    <SelectTrigger className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                      <SelectValue className="capitalize" placeholder={t("recurrence.never")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="never" className="capitalize">{t("recurrence.never")}</SelectItem>
                        <SelectItem value="daily" className="capitalize">{t("recurrence.daily")}</SelectItem>
                        <SelectItem value="weekly" className="capitalize">{t("recurrence.weekly")}</SelectItem>
                        <SelectItem value="monthly" className="capitalize">{t("recurrence.monthly")}</SelectItem>
                        <SelectItem value="quarterly" className="capitalize">{t("recurrence.quarterly")}</SelectItem>
                        <SelectItem value="yearly" className="capitalize">{t("recurrence.yearly")}</SelectItem>
                        <SelectItem value="custom">{t("recurrence.custom")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            }
          />
          {(isRecurring || mode === "edit-schedule") && recurrenceFrequency === "custom" ? (
            <FormSplitRow
              rowClassName="min-h-10"
              left={<span className="type-body-14 text-foreground">{t("fields.recurrenceInterval")}</span>}
              right={
                <div className="flex items-center justify-end gap-2">
                  <Controller
                    control={control}
                    name="recurrence_interval_count"
                    render={({ field }) => (
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        aria-label={t("fields.recurrenceInterval")}
                        className="h-8 w-16 rounded-none border-0 bg-transparent px-0 py-1 text-right text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                        value={field.value}
                        onChange={(event) => field.onChange(Math.max(1, Math.floor(Number(event.target.value)) || 1))}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="recurrence_interval_unit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                        <SelectTrigger
                          aria-label={t("fields.recurrenceInterval")}
                          className="h-auto w-auto border-0 bg-transparent px-0 py-0 text-right text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                        >
                          <SelectValue>{t(`recurrence.unit.${field.value}`, { count: recurrenceIntervalCount })}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(["day", "week", "month"] as const).map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {t(`recurrence.unit.${unit}`, { count: recurrenceIntervalCount })}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              }
            >
              <FieldMessage error={errors.recurrence_interval_count} />
            </FormSplitRow>
          ) : null}
          {isRecurring || mode === "edit-schedule" ? (
            <FormSplitRow
              rowClassName="min-h-10"
              left={<span className="type-body-14 text-foreground">{t("fields.recurrenceUntil")}</span>}
              right={
                recurrenceUntil === null ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setValue("recurrence_until", occurredAt, { shouldValidate: true })}
                  >
                    {t("fields.recurrenceUntilNever")}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <FlatDatePicker
                      value={recurrenceUntil}
                      onChange={(value) => setValue("recurrence_until", value, { shouldValidate: true })}
                      className="justify-end text-right"
                    />
                    <button
                      type="button"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setValue("recurrence_until", null, { shouldValidate: true })}
                    >
                      {t("fields.recurrenceUntilNever")}
                    </button>
                  </div>
                )
              }
            >
              <FieldMessage error={errors.recurrence_until} />
            </FormSplitRow>
          ) : null}
        </>
      ) : null}

      <FormPickerRow className="pt-4">
        <Input
          id="transaction-note"
          className="h-10 w-full rounded-none border-0 bg-transparent px-0 py-1 text-base leading-7 shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
          placeholder={t("placeholders.note")}
          {...register("note")}
        />
        <FieldMessage error={errors.note} />
      </FormPickerRow>
    </>
  );
}
