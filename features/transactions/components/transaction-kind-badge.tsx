import { ArrowLeftRight, BanknoteArrowDown, BanknoteArrowUp, Landmark, PiggyBank, RotateCcw, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { InlineIcon } from "@/components/ui/inline-icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

const kindConfig: Record<
  Transaction["kind"],
  {
    labelKey: Transaction["kind"];
    icon: React.ComponentType<{ className?: string }>;
    className: string;
    indicatorClassName: string;
    amountTone: "default" | "positive" | "negative";
  }
> = {
  income: {
    labelKey: "income",
    icon: BanknoteArrowUp,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "positive",
  },
  expense: {
    labelKey: "expense",
    icon: BanknoteArrowDown,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  transfer: {
    labelKey: "transfer",
    icon: ArrowLeftRight,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  save_to_goal: {
    labelKey: "save_to_goal",
    icon: PiggyBank,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  spend_from_goal: {
    labelKey: "spend_from_goal",
    icon: PiggyBank,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  debt_payment: {
    labelKey: "debt_payment",
    icon: Landmark,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  investment: {
    labelKey: "investment",
    icon: TrendingUp,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
  refund: {
    labelKey: "refund",
    icon: RotateCcw,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "positive",
  },
  adjustment: {
    labelKey: "adjustment",
    icon: SlidersHorizontal,
    className: "bg-secondary text-foreground",
    indicatorClassName: "bg-secondary text-foreground",
    amountTone: "default",
  },
};

export function getTransactionKindMeta(kind: Transaction["kind"]) {
  return kindConfig[kind];
}

export function TransactionKindBadge({ kind, className }: { kind: Transaction["kind"]; className?: string }) {
  const t = useTranslations("transactions.kinds");
  const config = getTransactionKindMeta(kind);
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn("gap-1 rounded-full border-0 px-2.5 py-1 type-body-12", config.className, className)}>
      <Icon className="h-3.5 w-3.5" />
      {t(config.labelKey)}
    </Badge>
  );
}

export function TransactionKindIndicator({
  kind,
  className,
}: {
  kind: Transaction["kind"];
  className?: string;
}) {
  const config = getTransactionKindMeta(kind);
  return <InlineIcon icon={config.icon} className={className} iconClassName="size-3.5 text-current sm:size-4" />;
}
