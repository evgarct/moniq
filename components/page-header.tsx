import { cn } from "@/lib/utils";

/**
 * Shared page header — matches Balance page header exactly.
 * Use on every authenticated page so transitions feel consistent.
 */
export function PageHeader({
  title,
  actions,
  scrolled = false,
  className,
}: {
  title: string;
  actions?: React.ReactNode;
  scrolled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card/96 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-card/88",
        scrolled && "shadow-[0_10px_24px_-22px_rgba(28,22,17,0.75)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:gap-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
        <div className="flex items-start justify-between gap-2 px-1.5 sm:gap-3 sm:px-2.5">
          <h1 className="font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
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
