"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  onSubmit: (values: WalletAllocationInput) => Promise<void> | void;
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? t("addTitle") : t("editTitle")}</SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="goal-name">
                {t("fields.name")}
              </label>
              <Input id="goal-name" autoComplete="off" placeholder={t("placeholders.name")} {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.type")}</label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange("goal_open")}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        field.value === "goal_open"
                          ? "border-foreground/20 bg-foreground/5 font-medium text-foreground"
                          : "border-border bg-white text-muted-foreground hover:border-foreground/15 hover:bg-muted/30"
                      }`}
                    >
                      <div className="font-medium">{t("types.open")}</div>
                      <div className="mt-0.5 text-xs opacity-70">{t("types.openDescription")}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("goal_targeted")}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        field.value === "goal_targeted"
                          ? "border-foreground/20 bg-foreground/5 font-medium text-foreground"
                          : "border-border bg-white text-muted-foreground hover:border-foreground/15 hover:bg-muted/30"
                      }`}
                    >
                      <div className="font-medium">{t("types.targeted")}</div>
                      <div className="mt-0.5 text-xs opacity-70">{t("types.targetedDescription")}</div>
                    </button>
                  </div>
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="goal-amount">
                {t("fields.currentAmount")}
              </label>
              <Input
                id="goal-amount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("amount", {
                  setValueAs: (value) => (value === "" ? 0 : Number(value)),
                })}
              />
              {form.formState.errors.amount ? (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>

            {kind === "goal_targeted" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="goal-target">
                  {t("fields.targetAmount")}
                </label>
                <Input
                  id="goal-target"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...form.register("target_amount", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
                {form.formState.errors.target_amount ? (
                  <p className="text-sm text-destructive">{form.formState.errors.target_amount.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" className="w-full">
              {mode === "add" ? t("submit.add") : t("submit.edit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
