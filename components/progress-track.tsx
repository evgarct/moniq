import { cn } from "@/lib/utils";

export function ProgressTrack({
  value,
  className,
  trackClassName,
  fillClassName,
}: {
  value: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
}) {
  const percentage = Math.min(Math.max(value, 0), 1) * 100;

  return (
    <div className={cn("radius-tight h-1 w-full overflow-hidden", trackClassName, className)}>
      <div
        className={cn("radius-tight h-full transition-[width,background-color]", fillClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
