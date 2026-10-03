import { cn } from "@/lib/utils";

const clampRatio = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Thin horizontal track. `value` is the solid fill (0..1). `secondaryValue` adds a lighter segment right after
 * it, e.g. planned spend after the actual spend; both are clamped so the track never overflows.
 */
export function ProgressTrack({
  value,
  secondaryValue = 0,
  className,
  trackClassName,
  fillClassName,
  secondaryFillClassName,
}: {
  value: number;
  secondaryValue?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  secondaryFillClassName?: string;
}) {
  const primary = clampRatio(value) * 100;
  const secondary = Math.min(clampRatio(secondaryValue) * 100, 100 - primary);

  return (
    <div className={cn("rounded-tight flex h-1 w-full overflow-hidden", trackClassName, className)}>
      <div
        className={cn("rounded-tight h-full shrink-0 transition-[width,background-color]", fillClassName)}
        style={{ width: `${primary}%` }}
      />
      {secondary > 0 ? (
        <div
          className={cn("h-full shrink-0 transition-[width,background-color]", secondaryFillClassName ?? "bg-foreground/22")}
          style={{ width: `${secondary}%` }}
        />
      ) : null}
    </div>
  );
}
