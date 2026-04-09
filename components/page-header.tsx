"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const pageToolbarButtonClassName =
  "rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]";

type ButtonProps = React.ComponentProps<typeof Button>;

export function PageHeader({
  title,
  description,
  actions,
  className,
  toolbarLabel,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  toolbarLabel?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
          {title}
        </h1>
        {description ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={pageToolbarButtonClassName}
                  aria-label={description}
                />
              }
            >
              <Info className="size-4 translate-y-[2px]" />
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-balance">{description}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-1 sm:gap-2" role="toolbar" aria-label={toolbarLabel ?? title}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function PageToolbarButton({
  className,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ButtonProps & {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(pageToolbarButtonClassName, className)}
      {...props}
    />
  );
}
