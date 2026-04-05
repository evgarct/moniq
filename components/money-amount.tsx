import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

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

  return (
    <span className={cn("tabular-nums", resolvedTone, className)}>
      {formatMoney(value, currency, { showMinorUnits })}
    </span>
  );
}
