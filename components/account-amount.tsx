import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

export function AccountAmount({
  amount,
  currency,
  tone = "default",
  display = "signed",
  showMinorUnits = true,
  className,
  numberClassName,
  currencyClassName,
}: {
  amount: number;
  currency: CurrencyCode;
  tone?: "default" | "muted" | "positive" | "negative";
  display?: "absolute" | "signed";
  showMinorUnits?: boolean;
  className?: string;
  numberClassName?: string;
  currencyClassName?: string;
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

  return (
    <span className={cn("inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-1", className)}>
      <span className={cn("justify-self-end tabular-nums whitespace-nowrap", resolvedTone, numberClassName)}>
        {formatMoneyNumber(value, currency, { showMinorUnits })}
      </span>
      <span
        className={cn(
          "justify-self-center text-[12px] leading-4 font-medium text-muted-foreground",
          currencyClassName,
        )}
      >
        {currencySymbol}
      </span>
    </span>
  );
}
