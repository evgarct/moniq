import { PencilLine } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import type { Allocation } from "@/types/finance";

export function AllocationItem({
  allocation,
  currency,
  onEdit,
}: {
  allocation: Allocation;
  currency: string;
  onEdit: (allocation: Allocation) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border/70 py-2">
      <div className="min-w-0 pr-4">
        <p className="truncate text-[13px] font-medium">{allocation.name}</p>
        <p className="text-[11px] text-muted-foreground">Reserved inside this savings account.</p>
      </div>
      <MoneyAmount amount={allocation.amount} currency={currency} display="absolute" className="text-[15px] font-semibold text-right" />
      <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-sm justify-self-end" onClick={() => onEdit(allocation)}>
        <PencilLine className="h-3.5 w-3.5" />
        <span className="sr-only">Edit allocation</span>
      </Button>
    </div>
  );
}
