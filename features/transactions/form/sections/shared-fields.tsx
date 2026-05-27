"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlatDatePicker, FieldMessage, FormPickerRow, FormSplitRow } from "@/components/form-primitives";
import { cn } from "@/lib/utils";

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
  const note = watch("note");

  const showRecurrenceSection =
    showRecurrence && (status === "planned" || mode === "edit-schedule");

  return (
    <>
      <FormSplitRow
        rowClassName="pt-5"
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
                <Select value={field.value} onValueChange={field.onChange} disabled={mode === "edit-schedule"}>
                  <SelectTrigger
                    className={cn(
                      "h-auto w-auto border-0 bg-transparent px-0 py-0 text-right text-[14px] font-medium shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0 data-[popup-open]:opacity-90",
                      field.value === "paid" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        field.value === "paid" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {field.value === "paid" ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                      <span>{field.value === "paid" ? t("status.paid") : t("status.planned")}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">{t("status.paid")}</SelectItem>
                    <SelectItem value="planned">{t("status.planned")}</SelectItem>
                  </SelectContent>
                </Select>
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
            rowClassName="min-h-8 py-0 pt-4"
            left={<span className="text-sm text-foreground">{t("fields.recurrenceFrequency")}</span>}
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
                      <SelectItem value="never" className="capitalize">{t("recurrence.never")}</SelectItem>
                      <SelectItem value="daily" className="capitalize">{t("recurrence.daily")}</SelectItem>
                      <SelectItem value="weekly" className="capitalize">{t("recurrence.weekly")}</SelectItem>
                      <SelectItem value="monthly" className="capitalize">{t("recurrence.monthly")}</SelectItem>
                      <SelectItem value="yearly" className="capitalize">{t("recurrence.yearly")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            }
          />
          {(isRecurring || mode === "edit-schedule") && recurrenceFrequency === "weekly" ? (
            <FormSplitRow
              rowClassName="min-h-8 py-0 -mt-1"
              left={<span className="text-sm text-foreground">{t("fields.recurrenceIntervalWeeks")}</span>}
              right={
                <Controller
                  control={control}
                  name="recurrence_interval_weeks"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="h-8 w-20 rounded-none border-0 bg-transparent px-0 py-1 text-right text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                    />
                  )}
                />
              }
            >
              <FieldMessage error={errors.recurrence_interval_weeks} />
            </FormSplitRow>
          ) : null}
          {isRecurring || mode === "edit-schedule" ? (
            <FormSplitRow
              rowClassName="min-h-8 py-0 -mt-1"
              left={<span className="text-sm text-foreground">{t("fields.recurrenceUntil")}</span>}
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

      <FormPickerRow className={cn("pt-4", !note?.trim() && "border-b-0")}>
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
