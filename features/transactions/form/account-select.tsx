"use client";

import { BanknoteArrowDown, CreditCard, Landmark, PiggyBank } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { FieldMessage } from "@/components/form-primitives";
import { InlineIcon } from "@/components/ui/inline-icon";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatters";
import type { Account } from "@/types/finance";

import { toSelectValue } from "./helpers";
import type { TransactionFormInputs } from "./types";

export function getAccountIcon(account?: Account | null) {
  if (!account) return BanknoteArrowDown;
  if (account.type === "saving") return PiggyBank;
  if (account.type === "credit_card") return CreditCard;
  if (account.type === "debt") return Landmark;
  return BanknoteArrowDown;
}

export function AccountSelect({
  name,
  accounts,
  placeholder,
  className,
  onChange: onChangeProp,
}: {
  name: "source_account_id" | "destination_account_id";
  accounts: Account[];
  placeholder: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const { control, formState: { errors } } = useFormContext<TransactionFormInputs>();
  const error = errors[name] as import("react-hook-form").FieldError | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedAccount = accounts.find((a) => a.id === field.value);
        const AccountIcon = getAccountIcon(selectedAccount);

        return (
          <div className={cn("flex flex-col gap-1", className)}>
            <Select
              value={toSelectValue(field.value)}
              onValueChange={(v) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (field.onChange as (v: any) => void)(v || null);
                if (v) onChangeProp?.(v);
              }}
            >
              <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
                <div className="flex min-w-0 items-center justify-between w-full gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <InlineIcon icon={AccountIcon} />
                    <span className={cn("truncate text-left", selectedAccount ? "text-foreground" : "text-muted-foreground")}>
                      {selectedAccount?.name ?? placeholder}
                    </span>
                  </div>
                  {selectedAccount && (
                    <span className="text-muted-foreground text-xs font-normal tabular-nums ml-auto shrink-0 mr-4">
                      {formatMoney(selectedAccount.balance, selectedAccount.currency)}
                    </span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {accounts.map((account) => {
                    const Icon = getAccountIcon(account);
                    return (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex min-w-0 w-full items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <InlineIcon icon={Icon} />
                            <span className="truncate">{account.name}</span>
                          </div>
                          <span className="text-muted-foreground text-xs tabular-nums shrink-0">
                            {formatMoney(account.balance, account.currency)}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldMessage error={error} />
          </div>
        );
      }}
    />
  );
}
