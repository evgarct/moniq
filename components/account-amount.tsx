import { formatMoneyNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

export function AccountAmount({
  amount,
  currency,
  tone = "default",
  display = "signed",
  className,
  numberClassName,
  currencyClassName,
}: {
  amount: number;
  currency: CurrencyCode;
  tone?: "default" | "muted" | "positive" | "negative";
  display?: "absolute" | "signed";
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

  return (
    <span className={cn("inline-grid grid-cols-[minmax(0,max-content)_3.5ch] items-baseline justify-end gap-2", className)}>
      <span className={cn("justify-self-end tabular-nums whitespace-nowrap", resolvedTone, numberClassName)}>
        {formatMoneyNumber(value, currency)}
      </span>
      <span
        className={cn(
          "justify-self-end text-[11px] leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase",
          currencyClassName,
        )}
      >
        {currency}
      </span>
    </span>
  );
}
