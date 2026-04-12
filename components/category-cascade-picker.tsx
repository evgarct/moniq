"use client";

import { ChevronDown } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/finance";

type PickerCategory = Pick<Category, "id" | "name" | "icon" | "parent_id">;

type CategoryCascadePickerProps = {
  categories: PickerCategory[];
  value: string | null;
  onSelect: (value: string | null) => void;
  placeholder: string;
  clearLabel?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

type CategoryGroup = {
  parent: PickerCategory;
  children: PickerCategory[];
};

function buildCategoryGroups(categories: PickerCategory[]) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups: CategoryGroup[] = [];
  const groupById = new Map<string, CategoryGroup>();

  for (const category of categories) {
    if (category.parent_id && categoryById.has(category.parent_id)) continue;
    const group = { parent: category, children: [] };
    groups.push(group);
    groupById.set(category.id, group);
  }

  for (const category of categories) {
    if (!category.parent_id) continue;
    const group = groupById.get(category.parent_id);
    if (group) {
      group.children.push(category);
    }
  }

  return groups;
}

function getSelectedCategoryPath(categories: PickerCategory[], value: string | null) {
  if (!value) return null;

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const category = categoryById.get(value);
  if (!category) return null;

  if (!category.parent_id) return category.name;

  const parent = categoryById.get(category.parent_id);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function CategoryCascadePicker({
  categories,
  value,
  onSelect,
  placeholder,
  clearLabel,
  className,
  triggerClassName,
  contentClassName,
}: CategoryCascadePickerProps) {
  const selectedLabel = getSelectedCategoryPath(categories, value);
  const selectedCategory = value ? categories.find((category) => category.id === value) ?? null : null;
  const groups = buildCategoryGroups(categories);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-0 py-0 text-left text-sm outline-none",
              triggerClassName,
            )}
          />
        }
      >
        <span className={cn("flex min-w-0 items-center gap-2", className)}>
          {selectedCategory ? (
            <CategoryIcon icon={selectedCategory.icon} glyphClassName="text-muted-foreground" />
          ) : null}
          <span className={cn("truncate", selectedCategory ? "text-foreground" : "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("min-w-[15rem]", contentClassName)}>
        {clearLabel ? <DropdownMenuItem onClick={() => onSelect(null)}>{clearLabel}</DropdownMenuItem> : null}
        {groups.map((group) =>
          group.children.length ? (
            <DropdownMenuSub key={group.parent.id}>
              <DropdownMenuSubTrigger>
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryIcon icon={group.parent.icon} glyphClassName="text-muted-foreground" />
                  <span className="truncate">{group.parent.name}</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[14rem]">
                {group.children.map((category) => (
                  <DropdownMenuItem key={category.id} onClick={() => onSelect(category.id)}>
                    <div className="flex min-w-0 items-center gap-2">
                      <CategoryIcon icon={category.icon} glyphClassName="text-muted-foreground" />
                      <span className="truncate">{category.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <div key={group.parent.id}>
              <DropdownMenuItem onClick={() => onSelect(group.parent.id)}>
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryIcon icon={group.parent.icon} glyphClassName="text-muted-foreground" />
                  <span className="truncate">{group.parent.name}</span>
                </div>
              </DropdownMenuItem>
            </div>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
