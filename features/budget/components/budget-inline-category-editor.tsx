"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CategoryIconPicker } from "@/components/category-icon-picker";
import { FormField, FormSelectField } from "@/components/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectGroup, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCategoryDescendantIds } from "@/features/categories/lib/category-tree";
import type { Category, CategoryType } from "@/types/finance";
import type { CategoryInput } from "@/types/finance-schemas";

export function BudgetInlineCategoryEditor({
  category,
  categories,
  initialType,
  initialParentId,
  onSubmit,
  onCancel,
}: {
  category?: Category | null;
  categories: Category[];
  initialType: CategoryType;
  initialParentId?: string | null;
  onSubmit: (values: CategoryInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("categories.form");
  const commonT = useTranslations("common.actions");
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "folder");
  const [type, setType] = useState<CategoryType>(category?.type ?? initialType);
  const [parentId, setParentId] = useState<string | null>(category?.parent_id ?? initialParentId ?? null);
  const [nameError, setNameError] = useState<string | null>(null);

  const parentOptions = useMemo(() => {
    const excludedIds = category
      ? new Set([category.id, ...getCategoryDescendantIds(categories, category.id)])
      : new Set<string>();
    return categories.filter((item) => item.type === type && !excludedIds.has(item.id));
  }, [categories, category, type]);

  return (
    <form
      className="grid gap-4 border-t border-border/40 bg-secondary/20 px-3 py-4 lg:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setNameError(t("validation.nameRequired"));
          return;
        }
        onSubmit({
          name: name.trim(),
          description: description.trim() || null,
          icon,
          type,
          parent_id: parentId,
        });
      }}
    >
      <FormField id="budget-category-name" label={t("fields.name")} error={nameError ? { message: nameError } : undefined}>
        <Input
          id="budget-category-name"
          value={name}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(null);
          }}
          aria-invalid={Boolean(nameError)}
        />
      </FormField>

      <FormField id="budget-category-icon" label={t("fields.icon")}>
        <CategoryIconPicker id="budget-category-icon" value={icon} onValueChange={setIcon} />
      </FormField>

      <FormSelectField
        id="budget-category-type"
        label={t("fields.type")}
        value={type}
        onValueChange={(value) => {
          if (category?.purpose === "investment") return;
          if (value !== "expense" && value !== "income") return;
          setType(value);
          setParentId(null);
        }}
        triggerClassName={category?.purpose === "investment" ? "pointer-events-none opacity-60" : undefined}
      >
        <SelectGroup>
          <SelectItem value="expense">{t("types.expense")}</SelectItem>
          <SelectItem value="income">{t("types.income")}</SelectItem>
        </SelectGroup>
      </FormSelectField>

      <FormSelectField
        id="budget-category-parent"
        label={t("fields.parent")}
        value={parentId ?? "root"}
        onValueChange={(value) => setParentId(value === "root" ? null : value)}
      >
        <SelectGroup>
          <SelectItem value="root">{t("topLevel")}</SelectItem>
          {parentOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
          ))}
        </SelectGroup>
      </FormSelectField>

      <FormField id="budget-category-description" label={t("fields.description")} className="lg:col-span-2">
        <Textarea
          id="budget-category-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-2 lg:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>{commonT("cancel")}</Button>
        <Button type="submit">{category ? commonT("update") : commonT("add")}</Button>
      </div>
    </form>
  );
}
