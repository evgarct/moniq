"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
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
import type { Category } from "@/types/finance";

export function CategoryDeleteSheet({
  open,
  category,
  replacementOptions,
  transactionCount,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  category: Category | null;
  replacementOptions: Category[];
  transactionCount: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (replacementCategoryId: string | null) => Promise<void> | void;
}) {
  const t = useTranslations("categories.delete");
  const defaultReplacement = useMemo(
    () => replacementOptions[0]?.id ?? null,
    [replacementOptions],
  );
  const [replacementCategoryId, setReplacementCategoryId] = useState<string | null>(defaultReplacement);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>
            {transactionCount > 0
              ? t("descriptionWithTransactions")
              : t("descriptionWithoutTransactions")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col p-4">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CategoryIcon icon={category?.icon} glyphClassName="text-foreground" />
                <span>{category?.name}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t("linkedTransactions", { count: transactionCount })}</p>
            </div>

            {transactionCount > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("replacementCategory")}</label>
                <Select value={replacementCategoryId ?? undefined} onValueChange={setReplacementCategoryId}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {replacementOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <CategoryIcon icon={option.icon} glyphClassName="text-muted-foreground" />
                        <span>{option.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <SheetFooter className="mt-auto border-t px-0 pb-0">
            <Button
              variant="default"
              className="w-full bg-rose-600 text-white hover:bg-rose-700"
              disabled={transactionCount > 0 && !replacementCategoryId}
              onClick={async () => {
                await onSubmit(transactionCount > 0 ? replacementCategoryId : null);
                onOpenChange(false);
              }}
            >
              {t("submit")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
