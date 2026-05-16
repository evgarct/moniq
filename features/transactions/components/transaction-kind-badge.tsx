import { ArrowLeftRight, BanknoteArrowDown, BanknoteArrowUp, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";

import { InlineIcon } from "@/components/ui/inline-icon";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Transaction } from "@/types/finance";

const kindConfig: Record<
  Transaction["kind"],
  {
    labelKey: Transaction["kind"];
    icon: LucideIcon;
    amountTone: "default" | "positive" | "negative";
  }
> = {
  income: {
    labelKey: "income",
    icon: BanknoteArrowUp,
    amountTone: "positive",
  },
  expense: {
    labelKey: "expense",
    icon: BanknoteArrowDown,
    amountTone: "default",
  },
  transfer: {
    labelKey: "transfer",
    icon: ArrowLeftRight,
    amountTone: "default",
  },
  debt_payment: {
    labelKey: "debt_payment",
    icon: Landmark,
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
    <span className={cn("inline-flex items-center gap-1 type-body-12 text-muted-foreground", className)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {t(config.labelKey)}
    </span>
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
