import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function MoneyAmount({
  amount,
  currency = "USD",
  variant = "default",
  className,
}: {
  amount: number;
  currency?: string;
  variant?: "default" | "muted";
  className?: string;
}) {
  const tone =
    variant === "muted"
      ? "text-muted-foreground"
      : amount < 0
        ? "text-emerald-600"
        : "text-foreground";

  return (
    <span className={cn("font-mono tabular-nums", tone, className)}>
      {formatMoney(Math.abs(amount), currency)}
    </span>
  );
}
