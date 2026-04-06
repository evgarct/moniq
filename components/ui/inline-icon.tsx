import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

export function InlineIcon({
  icon: Icon,
  className,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center", className)}>
      <Icon className={cn("size-4 text-muted-foreground sm:size-[18px]", iconClassName)} strokeWidth={1.75} />
    </span>
  );
}
