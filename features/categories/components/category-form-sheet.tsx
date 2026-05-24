"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { CategoryIcon } from "@/components/category-icon";
import {
  FormField,
  FormSelectField,
  FormSheet,
  FormSheetBody,
} from "@/components/form-sheet";
import { Input } from "@/components/ui/input";
import { SelectGroup, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    description: z.string().trim().max(600, t("validation.descriptionMax")).nullable().optional(),
    icon: z.string().trim().max(48, t("validation.iconMax")).nullable().optional(),
    type: z.enum(["income", "expense"]),
    parent_id: z.string().uuid().nullable().optional(),
  });
  const form = useForm<CategoryFormInputs, undefined, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "folder",
      type: category?.type ?? "expense",
      parent_id: category?.parent_id ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      name: category?.name ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "folder",
      type: category?.type ?? "expense",
      parent_id: category?.parent_id ?? null,
    });
  }, [category, form, open]);

  const selectedType = useWatch({ control: form.control, name: "type" });
  const parentOptions = categories.filter((item) => item.type === selectedType && item.id !== category?.id);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "add" ? t("addTitle") : t("editTitle")}
      description={t("description")}
      submitLabel={mode === "add" ? t("submit.add") : t("submit.edit")}
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
        onOpenChange(false);
      })}
    >
      <FormSheetBody>
        <FormField id="category-name" label={t("fields.name")} error={form.formState.errors.name}>
          <Input
            id="category-name"
            autoComplete="off"
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </FormField>

        <FormField
          id="category-description"
          label={t("fields.description")}
          error={form.formState.errors.description}
        >
          <Textarea
            id="category-description"
            rows={4}
            autoComplete="off"
            aria-invalid={Boolean(form.formState.errors.description)}
            {...form.register("description")}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
          <FormField id="category-icon" label={t("fields.icon")} error={form.formState.errors.icon}>
            <Input
              id="category-icon"
              maxLength={48}
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.icon)}
              {...form.register("icon")}
            />
          </FormField>

          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
            <FormSelectField
              id="category-type"
              label={t("fields.type")}
              error={form.formState.errors.type}
              value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("parent_id", null, { shouldDirty: true });
                }}
              >
                <SelectGroup>
                  <SelectItem value="expense">{t("types.expense")}</SelectItem>
                  <SelectItem value="income">{t("types.income")}</SelectItem>
                </SelectGroup>
              </FormSelectField>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="parent_id"
          render={({ field }) => (
            <FormSelectField
              id="category-parent"
              label={t("fields.parent")}
              error={form.formState.errors.parent_id}
              value={field.value ?? "root"}
              onValueChange={(value) => field.onChange(value === "root" ? null : value)}
            >
              <SelectGroup>
                <SelectItem value="root">{t("topLevel")}</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <CategoryIcon icon={option.icon} glyphClassName="text-muted-foreground" />
                    <span>{option.name}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </FormSelectField>
          )}
        />
      </FormSheetBody>
    </FormSheet>
  );
}
