import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

/**
 * Unified money display component.
 * Currency symbol always appears after the number with a small gap.
 * Font size is inherited from parent — pass className to control it.
 */
export function MoneyAmount({
  amount,
  currency = "EUR",
  tone = "default",
  display = "signed",
  showMinorUnits = true,
  className,
}: {
  amount: number;
  currency?: CurrencyCode;
  tone?: "default" | "muted" | "positive" | "negative";
  display?: "absolute" | "signed";
  showMinorUnits?: boolean;
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

  return (
    <span
      className={cn(
        "inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-[0.35em]",
        resolvedTone,
        className,
      )}
    >
      <span className="justify-self-end tabular-nums whitespace-nowrap tracking-[-0.025em]">
        {formatMoneyNumber(value, currency, { showMinorUnits })}
      </span>
      <span className="justify-self-center text-[0.8em] opacity-70">
        {currencySymbol}
      </span>
    </span>
  );
}
