"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { CategoryIcon, CATEGORY_ICON_OPTIONS } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function CategoryIconPicker({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: string | null | undefined;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("categories.form.iconPicker");
  const [open, setOpen] = useState(false);
  const selectedValue = CATEGORY_ICON_OPTIONS.includes(value ?? "") ? value! : "folder";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button id={id} type="button" variant="outline" className="w-full justify-between" />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CategoryIcon icon={selectedValue} glyphClassName="text-muted-foreground" />
          <span className="truncate">{t("selected")}</span>
        </span>
        <ChevronDown data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>{t("title")}</PopoverTitle>
          <PopoverDescription>{t("description")}</PopoverDescription>
        </PopoverHeader>
        <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto pt-1" role="listbox" aria-label={t("title")}>
          {CATEGORY_ICON_OPTIONS.map((icon) => {
            const selected = icon === selectedValue;
            return (
              <Button
                key={icon}
                type="button"
                variant="ghost"
                size="icon"
                className={cn(selected && "bg-secondary text-foreground")}
                aria-label={t("choose", { icon })}
                aria-selected={selected}
                role="option"
                onClick={() => {
                  onValueChange(icon);
                  setOpen(false);
                }}
              >
                <CategoryIcon icon={icon} glyphClassName="text-muted-foreground" />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
