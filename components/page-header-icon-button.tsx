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
            variant="ghost"
            size="icon-sm"
            className={cn(
              "border-none bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary/85",
              pressed && "bg-secondary text-foreground hover:bg-secondary/90",
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
