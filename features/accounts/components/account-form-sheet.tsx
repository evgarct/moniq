"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";

import {
  DEFAULT_CURRENCY_CODE,
  PRIMARY_CURRENCIES,
  SECONDARY_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
} from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import type { CurrencyCode } from "@/types/currency";
import type { Account, AccountType, DebtKind } from "@/types/finance";

const accountTypes = ["cash", "saving", "credit_card", "debt"] satisfies [AccountType, ...AccountType[]];
const debtKinds = ["loan", "mortgage", "personal"] satisfies [DebtKind, ...DebtKind[]];

type AccountFormValues = {
  name: string;
  type: AccountType;
  balance: number;
  credit_limit: number | null;
  currency: CurrencyCode;
  debt_kind?: DebtKind;
};
type AccountFormInputs = AccountFormValues;

export function AccountFormSheet({
  open,
  mode,
  account,
  initialType,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  account?: Account | null;
  initialType?: Account["type"];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AccountFormValues) => Promise<void> | void;
}) {
  const accountsT = useTranslations("accounts");
  const t = useTranslations("accounts.form");
  const common = useTranslations("common.currencyGroups");
  const accountFormSchema = z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    type: z.enum(accountTypes),
    balance: z.number(),
    credit_limit: z.number().positive(t("validation.creditLimitPositive")).nullable(),
    currency: z.enum(SUPPORTED_CURRENCY_CODES),
    debt_kind: z.enum(debtKinds).optional(),
  }).superRefine((values, ctx) => {
    if (values.type === "credit_card" && (values.credit_limit == null || values.credit_limit <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credit_limit"],
        message: t("validation.creditLimitRequired"),
      });
    }

    if (
      values.type === "credit_card" &&
      values.credit_limit != null &&
      Math.abs(values.balance) - values.credit_limit > 0.01
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["balance"],
        message: t("validation.creditLimitExceeded"),
      });
    }
  });
  const form = useForm<AccountFormInputs, undefined, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? initialType ?? "cash",
      balance: account ? Math.abs(account.balance) : 0,
      credit_limit: account?.type === "credit_card" ? account.credit_limit ?? null : null,
      currency: account?.currency ?? DEFAULT_CURRENCY_CODE,
      debt_kind: account?.debt_kind ?? undefined,
    },
  });

  useEffect(() => {
    form.reset({
      name: account?.name ?? "",
      type: account?.type ?? initialType ?? "cash",
      balance: account ? Math.abs(account.balance) : 0,
      credit_limit: account?.type === "credit_card" ? account.credit_limit ?? null : null,
      currency: account?.currency ?? DEFAULT_CURRENCY_CODE,
      debt_kind: account?.debt_kind ?? undefined,
    });
  }, [account, form, initialType, open]);

  const type = useWatch({
    control: form.control,
    name: "type",
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === "add" ? t("addTitle") : t("editTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit({
              ...values,
              credit_limit: values.type === "credit_card" ? values.credit_limit ?? null : null,
              currency: values.currency,
              debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : undefined,
            });
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="wallet-name">
                {t("fields.name")}
              </label>
              <Input id="wallet-name" autoComplete="off" {...form.register("name")} />
              {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="wallet-type">
                {t("fields.type")}
              </label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="wallet-type" aria-label={t("fields.type")} className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="cash">{accountsT("walletTypes.cash")}</SelectItem>
                      <SelectItem value="saving">{accountsT("walletTypes.saving")}</SelectItem>
                      <SelectItem value="credit_card">{accountsT("walletTypes.credit_card")}</SelectItem>
                      <SelectItem value="debt">{accountsT("walletTypes.debt")}</SelectItem>
                      </SelectContent>
                  </Select>
                )}
              />
            </div>

            {type === "debt" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-debt-kind">
                  {t("fields.debtKind")}
                </label>
                <Controller
                  control={form.control}
                  name="debt_kind"
                  render={({ field }) => (
                    <Select value={field.value ?? "personal"} onValueChange={field.onChange}>
                      <SelectTrigger id="wallet-debt-kind" aria-label={t("fields.debtKind")} className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan">{accountsT("walletTypes.loan")}</SelectItem>
                        <SelectItem value="mortgage">{accountsT("walletTypes.mortgage")}</SelectItem>
                        <SelectItem value="personal">{accountsT("walletTypes.personal")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-balance">
                  {type === "credit_card" ? t("fields.currentBalance") : t("fields.balance")}
                </label>
                <Input
                  id="wallet-balance"
                  type="number"
                  step="0.01"
                  {...form.register("balance", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                />
                {form.formState.errors.balance ? (
                  <p className="text-sm text-destructive">{form.formState.errors.balance.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-currency">
                  {t("fields.currency")}
                </label>
                <Controller
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as CurrencyCode)}>
                      <SelectTrigger id="wallet-currency" aria-label={t("fields.currency")} className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{common("primary")}</SelectLabel>
                          {PRIMARY_CURRENCIES.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              <span>{currency.code}</span>
                              <span className="text-muted-foreground">{currency.name}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>{common("secondary")}</SelectLabel>
                          {SECONDARY_CURRENCIES.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              <span>{currency.code}</span>
                              <span className="text-muted-foreground">{currency.name}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {type === "credit_card" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="wallet-credit-limit">
                  {t("fields.creditLimit")}
                </label>
                <Input
                  id="wallet-credit-limit"
                  type="number"
                  step="0.01"
                  {...form.register("credit_limit", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
                {form.formState.errors.credit_limit ? (
                  <p className="text-sm text-destructive">{form.formState.errors.credit_limit.message}</p>
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
