"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import type { Allocation } from "@/types/finance";

const allocationFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  amount: z.number().min(0, "Amount cannot go below 0."),
});

type AllocationFormValues = z.output<typeof allocationFormSchema>;
type AllocationFormInputs = z.input<typeof allocationFormSchema>;

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
  currency: string;
  freeMoney: number;
  allocation?: Allocation | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AllocationFormValues) => void;
}) {
  const form = useForm<AllocationFormInputs, undefined, AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      name: allocation?.name ?? "",
      amount: allocation?.amount ?? 0,
    },
  });

  useEffect(() => {
    form.reset({
      name: allocation?.name ?? "",
      amount: allocation?.amount ?? 0,
    });
  }, [allocation, form, open]);

  const amount = useWatch({
    control: form.control,
    name: "amount",
  });
  const releaseBaseline = allocation?.amount ?? 0;
  const projectedFreeMoney = freeMoney + releaseBaseline - (Number.isFinite(amount) ? amount : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? "Add allocation" : "Edit allocation"}</SheetTitle>
          <SheetDescription>
            Allocate savings without changing the account balance.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit((values) => {
            if (projectedFreeMoney < 0) {
              form.setError("amount", {
                message: "This allocation would exceed the available savings balance.",
              });
              return;
            }

            onSubmit(values);
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projected free money</p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(projectedFreeMoney)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="allocation-name">
                Allocation name
              </label>
              <Input id="allocation-name" {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="allocation-amount">
                Amount
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
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" className="w-full">
              {mode === "add" ? "Save allocation" : "Update allocation"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
