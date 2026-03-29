"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CurrencyCode } from "@/types/currency";
import type { Allocation } from "@/types/finance";

const rebalanceSchema = z.object({
  allocations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      amount: z.number().min(0, "Amount cannot go below 0."),
    }),
  ),
});

type RebalanceValues = z.output<typeof rebalanceSchema>;
type RebalanceInputs = z.input<typeof rebalanceSchema>;

export function RebalancePanel({
  open,
  accountName,
  balance,
  currency,
  allocations,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  accountName: string;
  balance: number;
  currency: CurrencyCode;
  allocations: Allocation[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (allocations: Allocation[]) => void;
}) {
  const form = useForm<RebalanceInputs, undefined, RebalanceValues>({
    resolver: zodResolver(rebalanceSchema),
    defaultValues: {
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        name: allocation.name,
        amount: allocation.amount,
      })),
    },
  });
  const { fields } = useFieldArray({
    control: form.control,
    name: "allocations",
  });

  useEffect(() => {
    form.reset({
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        name: allocation.name,
        amount: allocation.amount,
      })),
    });
  }, [allocations, form, open]);

  const watchedAllocations = useWatch({
    control: form.control,
    name: "allocations",
  });
  const allocatedTotal = useMemo(
    () => (watchedAllocations ?? []).reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0),
    [watchedAllocations],
  );
  const freeMoney = balance - allocatedTotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Rebalance goals</SheetTitle>
          <SheetDescription>
            Reduce or adjust reserved goal amounts inside {accountName} without moving cash between accounts.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit((values) => {
            if (allocatedTotal > balance) {
              form.setError("root", {
                message: "Total allocations cannot exceed the savings account balance.",
              });
              return;
            }

            onSubmit(
              allocations.map((allocation) => ({
                ...allocation,
                amount: values.allocations.find((candidate) => candidate.id === allocation.id)?.amount ?? allocation.amount,
              })),
            );
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current free money</p>
                <MoneyAmount
                  amount={freeMoney}
                  currency={currency}
                  tone={freeMoney <= 0 ? "negative" : "positive"}
                  className="mt-2 text-lg font-semibold"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Allocated total</p>
                <MoneyAmount amount={allocatedTotal} currency={currency} display="absolute" className="mt-2 text-lg font-semibold" />
              </div>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{field.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Lowering this amount releases money back into free money.
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-32"
                      {...form.register(`allocations.${index}.amount`, {
                        setValueAs: (value) => Number(value),
                      })}
                    />
                  </div>
                  {form.formState.errors.allocations?.[index]?.amount ? (
                    <p className="mt-2 text-sm text-destructive">
                      {form.formState.errors.allocations[index]?.amount?.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {form.formState.errors.root ? (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            ) : null}
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" className="w-full">
              Save rebalance
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
