import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

export function LedgerAmount({
  amount,
  currency,
  tone = "default",
  display = "absolute",
  showMinorUnits = true,
  emphasized = false,
  compact = false,
  className,
}: {
  amount: number;
  currency: CurrencyCode;
  tone?: "default" | "muted" | "positive" | "negative";
  display?: "absolute" | "signed";
  showMinorUnits?: boolean;
  emphasized?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const resolvedTone =
    tone === "default"
      ? amount < 0
        ? "text-destructive"
        : "text-foreground"
      : tone === "muted"
        ? "text-muted-foreground"
        : tone === "positive"
          ? "text-emerald-600"
          : "text-destructive";
  const value = display === "absolute" ? Math.abs(amount) : amount;
  const currencySymbol = getCurrencySymbol(currency);
  const amountNode = (
    <span className={cn("inline-grid w-auto grid-cols-[minmax(0,max-content)_2.15ch] items-baseline justify-end gap-0.5", !emphasized && className)}>
      <span
        className={cn(
          "justify-self-end whitespace-nowrap tabular-nums tracking-[-0.025em]",
          emphasized ? "text-primary-foreground" : resolvedTone,
          compact ? "text-[12px] leading-4 font-medium" : "text-[14px] leading-6 font-medium",
        )}
      >
        {formatMoneyNumber(value, currency, { showMinorUnits })}
      </span>
      <span
        className={cn(
          "justify-self-center font-medium tracking-[-0.025em]",
          emphasized ? "text-primary-foreground/82" : "text-muted-foreground",
          compact ? "text-[11px] leading-4 -translate-y-[1px]" : "text-[12px] leading-6",
        )}
      >
        {currencySymbol}
      </span>
    </span>
  );

  if (!emphasized) {
    return amountNode;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-end rounded-sm bg-primary px-2 py-1 text-primary-foreground",
        "-mr-1",
        className,
      )}
    >
      {amountNode}
    </span>
  );
}
