"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { allocationInputSchema } from "@/types/finance-schemas";
import { formatMoney } from "@/lib/formatters";
import type { CurrencyCode } from "@/types/currency";
import type { Allocation } from "@/types/finance";

type AllocationFormValues = import("@/types/finance-schemas").AllocationInput;
type AllocationFormInputs = import("@/types/finance-schemas").AllocationInputValues;

export function AllocationFormSheet({
  open,
  mode,
  currency,
  freeMoney,
  allocation,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  currency: CurrencyCode;
  freeMoney: number;
  allocation?: Allocation | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AllocationFormValues) => Promise<void> | void;
}) {
  const form = useForm<AllocationFormInputs, undefined, AllocationFormValues>({
    resolver: zodResolver(allocationInputSchema),
    defaultValues: {
      name: allocation?.name ?? "",
      amount: allocation?.amount ?? 0,
      kind: allocation?.kind ?? "goal_open",
      target_amount: allocation?.target_amount ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      name: allocation?.name ?? "",
      amount: allocation?.amount ?? 0,
      kind: allocation?.kind ?? "goal_open",
      target_amount: allocation?.target_amount ?? null,
    });
  }, [allocation, form, open]);

  const amount = useWatch({
    control: form.control,
    name: "amount",
  });
  const kind = useWatch({
    control: form.control,
    name: "kind",
  });
  const releaseBaseline = allocation?.amount ?? 0;
  const projectedFreeMoney = freeMoney + releaseBaseline - (Number.isFinite(amount) ? amount : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? "Add goal" : "Edit goal"}</SheetTitle>
          <SheetDescription>
            Reserve savings for a flexible goal or a goal with a target amount.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            if (projectedFreeMoney < 0) {
              form.setError("amount", {
                message: "This allocation would exceed the available savings balance.",
              });
              return;
            }

            await onSubmit(values);
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projected free money</p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {formatMoney(projectedFreeMoney, currency)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="allocation-name">
                Goal name
              </label>
              <Input id="allocation-name" {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Goal type</label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "goal_open") {
                        form.setValue("target_amount", null, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="goal_open">Flexible goal</SelectItem>
                      <SelectItem value="goal_targeted">Targeted goal</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="allocation-amount">
                Current amount
              </label>
              <Input
                id="allocation-amount"
                type="number"
                min="0"
                step="0.01"
                {...form.register("amount", {
                  setValueAs: (value) => Number(value),
                })}
              />
              {form.formState.errors.amount ? (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>

            {kind === "goal_targeted" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="allocation-target-amount">
                  Target amount
                </label>
                <Input
                  id="allocation-target-amount"
                  type="number"
                  min="0"
                  step="0.01"
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
              {mode === "add" ? "Save goal" : "Update goal"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
