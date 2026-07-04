import { cn } from "@/lib/utils";

/**
 * Shared page header — matches Balance page header exactly.
 * Use on every authenticated page so transitions feel consistent.
 */
export function PageHeader({
  title,
  actions,
  scrolled = false,
  tone = "canvas",
  className,
}: {
  title: string;
  actions?: React.ReactNode;
  scrolled?: boolean;
  tone?: "canvas" | "panel";
  className?: string;
}) {
  const toneClasses = {
    canvas: scrolled
      ? "bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:bg-background/90 lg:supports-[backdrop-filter]:bg-background/80"
      : "bg-card lg:bg-background",
    panel: scrolled
      ? "bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      : "bg-card",
  };

  return (
    <div
      className={cn(
        "transition-[background-color,border-color,box-shadow] duration-200",
        toneClasses[tone],
        scrolled
          ? "border-b border-border/40 shadow-[0_4px_12px_-4px_rgba(28,22,17,0.08)]"
          : "border-b border-transparent",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:gap-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
        <div className="flex min-w-0 items-center justify-between gap-2 px-1.5 sm:gap-3 sm:px-2.5">
          <h1 className="min-w-0 flex-1 text-balance font-heading text-[28px] leading-[1.02] tracking-[-0.035em] text-foreground sm:type-h1">
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
