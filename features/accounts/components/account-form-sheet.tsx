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
import {
  FormField,
  FormSelectField,
  FormSheet,
  FormSheetBody,
} from "@/components/form-sheet";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
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
  onSubmit: (values: AccountFormValues) => void;
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
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "add" ? t("addTitle") : t("editTitle")}
      description={t("description")}
      submitLabel={mode === "add" ? t("submit.add") : t("submit.edit")}
      onSubmit={form.handleSubmit((values) => {
        onSubmit({
          ...values,
          credit_limit: values.type === "credit_card" ? values.credit_limit ?? null : null,
          currency: values.currency,
          debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : undefined,
        });
        onOpenChange(false);
      })}
    >
      <FormSheetBody>
        <FormField id="wallet-name" label={t("fields.name")} error={form.formState.errors.name}>
          <Input
            id="wallet-name"
            autoComplete="off"
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </FormField>

        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormSelectField
              id="wallet-type"
              label={t("fields.type")}
              error={form.formState.errors.type}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectGroup>
                <SelectItem value="cash">{accountsT("walletTypes.cash")}</SelectItem>
                <SelectItem value="saving">{accountsT("walletTypes.saving")}</SelectItem>
                <SelectItem value="credit_card">{accountsT("walletTypes.credit_card")}</SelectItem>
                <SelectItem value="debt">{accountsT("walletTypes.debt")}</SelectItem>
              </SelectGroup>
            </FormSelectField>
          )}
        />

        {type === "debt" ? (
          <Controller
            control={form.control}
            name="debt_kind"
            render={({ field }) => (
              <FormSelectField
                id="wallet-debt-kind"
                label={t("fields.debtKind")}
                error={form.formState.errors.debt_kind}
                value={field.value ?? "personal"}
                onValueChange={field.onChange}
              >
                <SelectGroup>
                  <SelectItem value="loan">{accountsT("walletTypes.loan")}</SelectItem>
                  <SelectItem value="mortgage">{accountsT("walletTypes.mortgage")}</SelectItem>
                  <SelectItem value="personal">{accountsT("walletTypes.personal")}</SelectItem>
                </SelectGroup>
              </FormSelectField>
            )}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="wallet-balance"
            label={type === "credit_card" ? t("fields.currentBalance") : t("fields.balance")}
            error={form.formState.errors.balance}
          >
            <Controller
              control={form.control}
              name="balance"
              render={({ field }) => (
                <MoneyInput
                  id="wallet-balance"
                  autoComplete="off"
                  aria-invalid={Boolean(form.formState.errors.balance)}
                  blankZeroOnFocus
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(value) => field.onChange(value ?? 0)}
                />
              )}
            />
          </FormField>

          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormSelectField
                id="wallet-currency"
                label={t("fields.currency")}
                error={form.formState.errors.currency}
                value={field.value}
                onValueChange={(value) => field.onChange(value as CurrencyCode)}
              >
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
              </FormSelectField>
            )}
          />
        </div>

        {type === "credit_card" ? (
          <FormField id="wallet-credit-limit" label={t("fields.creditLimit")} error={form.formState.errors.credit_limit}>
            <Controller
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <MoneyInput
                  id="wallet-credit-limit"
                  autoComplete="off"
                  aria-invalid={Boolean(form.formState.errors.credit_limit)}
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
