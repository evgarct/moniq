"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
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
import type { Category } from "@/types/finance";

type CategoryFormValues = import("@/types/finance-schemas").CategoryInput;
type CategoryFormInputs = import("@/types/finance-schemas").CategoryInputValues;

export function CategoryFormSheet({
  open,
  mode,
  category,
  categories,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  category?: Category | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
}) {
  const t = useTranslations("categories.form");
  const categoryFormSchema = z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    icon: z.string().trim().max(8, t("validation.iconMax")).nullable().optional(),
    type: z.enum(["income", "expense"]),
    parent_id: z.string().uuid().nullable().optional(),
  });
  const form = useForm<CategoryFormInputs, undefined, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      icon: category?.icon ?? "📁",
      type: category?.type ?? "expense",
      parent_id: category?.parent_id ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      name: category?.name ?? "",
      icon: category?.icon ?? "📁",
      type: category?.type ?? "expense",
      parent_id: category?.parent_id ?? null,
    });
  }, [category, form, open]);

  const selectedType = useWatch({ control: form.control, name: "type" });
  const parentOptions = categories.filter((item) => item.type === selectedType && item.id !== category?.id);

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
            await onSubmit(values);
            onOpenChange(false);
          })}
        >
          <div className="flex-1 space-y-5 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="category-name">
                {t("fields.name")}
              </label>
              <Input id="category-name" {...form.register("name")} />
              {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="category-icon">
                  {t("fields.icon")}
                </label>
                <Input id="category-icon" maxLength={8} {...form.register("icon")} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("fields.type")}</label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("parent_id", null, { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">{t("types.expense")}</SelectItem>
                        <SelectItem value="income">{t("types.income")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fields.parent")}</label>
              <Controller
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <Select value={field.value ?? "root"} onValueChange={(value) => field.onChange(value === "root" ? null : value)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">{t("topLevel")}</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <span>{option.icon ?? "•"}</span>
                          <span>{option.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
