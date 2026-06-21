"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PageHeaderIconButton({
  icon: Icon,
  label,
  pressed,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "size" | "aria-label"> & {
  icon: LucideIcon;
  label: string;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="secondary"
            size="icon-sm"
            className={cn(
              "border border-border/60 bg-secondary/75 text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary",
              pressed && "border-foreground/15 bg-secondary text-foreground",
              className,
            )}
            aria-label={label}
            aria-pressed={pressed}
            {...props}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
