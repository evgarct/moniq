import { ArrowLeftRight, BanknoteArrowDown, BanknoteArrowUp, Landmark, PiggyBank } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

const kindConfig: Record<Transaction["kind"], { labelKey: Transaction["kind"]; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  income: { labelKey: "income", icon: BanknoteArrowUp, className: "bg-muted text-muted-foreground" },
  expense: { labelKey: "expense", icon: BanknoteArrowDown, className: "bg-muted text-muted-foreground" },
  transfer: { labelKey: "transfer", icon: ArrowLeftRight, className: "bg-muted text-muted-foreground" },
  save_to_goal: { labelKey: "save_to_goal", icon: PiggyBank, className: "bg-muted text-muted-foreground" },
  spend_from_goal: { labelKey: "spend_from_goal", icon: PiggyBank, className: "bg-muted text-muted-foreground" },
  debt_payment: { labelKey: "debt_payment", icon: Landmark, className: "bg-muted text-muted-foreground" },
};

export function TransactionKindBadge({ kind, className }: { kind: Transaction["kind"]; className?: string }) {
  const t = useTranslations("transactions.kinds");
  const config = kindConfig[kind];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn("gap-1 rounded-full border-0 px-2.5 py-1 type-body-12", config.className, className)}>
      <Icon className="h-3.5 w-3.5" />
      {t(config.labelKey)}
    </Badge>
  );
}
