"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import type { Account, AccountType, DebtKind } from "@/types/finance";

const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Wallet name is required."),
  type: z.enum(["cash", "saving", "credit_card", "debt"] satisfies [AccountType, ...AccountType[]]),
  balance: z.number(),
  currency: z.string().trim().min(3).max(3),
  debt_kind: z.enum(["loan", "mortgage", "personal"] satisfies [DebtKind, ...DebtKind[]]).optional(),
});

type AccountFormValues = z.output<typeof accountFormSchema>;
type AccountFormInputs = z.input<typeof accountFormSchema>;

export function AccountFormSheet({
  open,
  mode,
  account,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  account?: Account | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AccountFormValues) => void;
}) {
  const form = useForm<AccountFormInputs, undefined, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? "cash",
      balance: account?.balance ?? 0,
      currency: account?.currency ?? "USD",
      debt_kind: account?.debt_kind ?? undefined,
    },
  });

  useEffect(() => {
    form.reset({
      name: account?.name ?? "",
      type: account?.type ?? "cash",
      balance: account?.balance ?? 0,
      currency: account?.currency ?? "USD",
      debt_kind: account?.debt_kind ?? undefined,
    });
  }, [account, form, open]);

  const type = useWatch({
    control: form.control,
    name: "type",
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? "Add wallet" : "Edit wallet"}</SheetTitle>
          <SheetDescription>
            Cash wallets spend directly. Saving wallets hold money with optional subgroups.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit((values) => {
            onSubmit({
              ...values,
              currency: values.currency.toUpperCase(),
              debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : undefined,
            });
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="wallet-name">
                Wallet name
              </label>
              <Input id="wallet-name" {...form.register("name")} />
              {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="saving">Saving</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debt">Debt</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {type === "debt" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Debt kind</label>
                <Controller
                  control={form.control}
                  name="debt_kind"
                  render={({ field }) => (
                    <Select value={field.value ?? "personal"} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan">Loan</SelectItem>
                        <SelectItem value="mortgage">Mortgage</SelectItem>
                        <SelectItem value="personal">Personal Debt</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-balance">
                  Balance
                </label>
                <Input
                  id="wallet-balance"
                  type="number"
                  step="0.01"
                  {...form.register("balance", {
                    setValueAs: (value) => Number(value),
                  })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-currency">
                  Currency
                </label>
                <Input id="wallet-currency" maxLength={3} {...form.register("currency")} />
              </div>
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" className="w-full">
              {mode === "add" ? "Save wallet" : "Update wallet"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
