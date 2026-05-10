"use client";

import { Target } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { InlineIcon } from "@/components/ui/inline-icon";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WalletAllocation } from "@/types/finance";

import { toSelectValue } from "./helpers";
import type { TransactionFormInputs } from "./types";

const NONE = "__none__";

export function GoalSelect({ allocations }: { allocations: WalletAllocation[] }) {
  const t = useTranslations("transactions.form");
  const { control } = useFormContext<TransactionFormInputs>();

  return (
    <Controller
      control={control}
      name="allocation_id"
      render={({ field }) => {
        const selected = allocations.find((a) => a.id === field.value);

        return (
          <Select
            value={toSelectValue(field.value)}
            onValueChange={(v) =>
              (field.onChange as (v: string | null) => void)(v === NONE || !v ? null : v)
            }
          >
            <SelectTrigger className="h-auto w-full justify-start border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:ring-0">
              <div className="flex min-w-0 items-center gap-2">
                <InlineIcon icon={Target} />
                <span className={cn("truncate text-left", selected ? "text-foreground" : "text-muted-foreground")}>
                  {selected?.name ?? t("placeholders.goal")}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                <div className="flex min-w-0 items-center gap-2">
                  <InlineIcon icon={Target} />
                  <span className="text-muted-foreground">{t("placeholders.noGoal")}</span>
                </div>
              </SelectItem>
              {allocations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex min-w-0 items-center gap-2">
                    <InlineIcon icon={Target} />
                    <span className="truncate">{a.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }}
    />
  );
}
