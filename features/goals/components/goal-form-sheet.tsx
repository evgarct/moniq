"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { FormField, FormSheet, FormSheetBody } from "@/components/form-sheet";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { WalletAllocation, WalletAllocationKind } from "@/types/finance";
import type { WalletAllocationInput, WalletAllocationInputValues } from "@/types/finance-schemas";

const allocationKinds = ["goal_open", "goal_targeted"] satisfies [WalletAllocationKind, ...WalletAllocationKind[]];

export function GoalFormSheet({
  open,
  mode,
  allocation,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  allocation?: WalletAllocation | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WalletAllocationInput) => void;
}) {
  const t = useTranslations("accounts.goals.form");
  const goalFormSchema = z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    kind: z.enum(allocationKinds),
    amount: z.number().min(0, t("validation.amountMin")),
    target_amount: z.number().positive(t("validation.targetPositive")).nullable().optional(),
  }).superRefine((data, ctx) => {
    if (data.kind === "goal_targeted" && !data.target_amount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target_amount"], message: t("validation.targetRequired") });
    }
  }).transform((data) => ({
    ...data,
    target_amount: data.kind === "goal_targeted" ? (data.target_amount ?? null) : null,
  }));
  const form = useForm<WalletAllocationInputValues, undefined, WalletAllocationInput>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: allocation?.name ?? "",
      kind: allocation?.kind ?? "goal_open",
      amount: allocation?.amount ?? 0,
      target_amount: allocation?.target_amount ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      name: allocation?.name ?? "",
      kind: allocation?.kind ?? "goal_open",
      amount: allocation?.amount ?? 0,
      target_amount: allocation?.target_amount ?? null,
    });
  }, [allocation, form, open]);

  const kind = useWatch({ control: form.control, name: "kind" });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "add" ? t("addTitle") : t("editTitle")}
      submitLabel={mode === "add" ? t("submit.add") : t("submit.edit")}
      onSubmit={form.handleSubmit((values) => {
        onSubmit(values);
        onOpenChange(false);
      })}
    >
      <FormSheetBody>
        <FormField id="goal-name" label={t("fields.name")} error={form.formState.errors.name}>
          <Input
            id="goal-name"
            autoComplete="off"
            placeholder={t("placeholders.name")}
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </FormField>

        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormField label={t("fields.type")} error={form.formState.errors.kind}>
              <ToggleGroup
                value={[field.value]}
                onValueChange={(nextValue) => {
                  const [selectedKind] = nextValue;
                  if (selectedKind) {
                    field.onChange(selectedKind);
                  }
                }}
                className="grid w-full grid-cols-2 gap-2"
                spacing={2}
                variant="outline"
              >
                <ToggleGroupItem value="goal_open" className="h-auto min-h-16 flex-col items-start px-3 py-2.5 text-left">
                  <span className="type-body-14 font-medium">{t("types.open")}</span>
                  <span className={cn("type-body-12 text-muted-foreground", field.value === "goal_open" ? "text-foreground/70" : null)}>
                    {t("types.openDescription")}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem value="goal_targeted" className="h-auto min-h-16 flex-col items-start px-3 py-2.5 text-left">
                  <span className="type-body-14 font-medium">{t("types.targeted")}</span>
                  <span className={cn("type-body-12 text-muted-foreground", field.value === "goal_targeted" ? "text-foreground/70" : null)}>
                    {t("types.targetedDescription")}
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
            </FormField>
          )}
        />

        <FormField id="goal-amount" label={t("fields.currentAmount")} error={form.formState.errors.amount}>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="goal-amount"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.amount)}
                blankZeroOnFocus
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(value) => field.onChange(value ?? 0)}
              />
            )}
          />
        </FormField>

        {kind === "goal_targeted" ? (
          <FormField id="goal-target" label={t("fields.targetAmount")} error={form.formState.errors.target_amount}>
            <Controller
              control={form.control}
              name="target_amount"
              render={({ field }) => (
                <MoneyInput
                  id="goal-target"
                  autoComplete="off"
                  aria-invalid={Boolean(form.formState.errors.target_amount)}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
              )}
            />
          </FormField>
        ) : null}
      </FormSheetBody>
    </FormSheet>
  );
}
