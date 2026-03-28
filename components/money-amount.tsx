import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function MoneyAmount({
  amount,
  currency = "USD",
  tone = "default",
  display = "signed",
  className,
}: {
  amount: number;
  currency?: string;
  tone?: "default" | "muted" | "positive" | "negative";
  display?: "absolute" | "signed";
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
    <span className={cn("font-mono tabular-nums tracking-[-0.02em]", resolvedTone, className)}>
      {formatMoney(value, currency)}
    </span>
  );
}
