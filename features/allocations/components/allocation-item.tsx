import { PencilLine, Trash2 } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import type { CurrencyCode } from "@/types/currency";
import type { Allocation } from "@/types/finance";

export function AllocationItem({
  allocation,
  currency,
  onEdit,
  onDelete,
}: {
  allocation: Allocation;
  currency: CurrencyCode;
  onEdit: (allocation: Allocation) => void;
  onDelete?: (allocation: Allocation) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{allocation.name}</p>
        <p className="text-sm text-muted-foreground">Reserved inside this savings account.</p>
      </div>
      <div className="flex items-center gap-3">
        <MoneyAmount amount={allocation.amount} currency={currency} display="absolute" className="text-sm" />
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(allocation)}>
          <PencilLine className="h-4 w-4" />
          <span className="sr-only">Edit allocation</span>
        </Button>
        {onDelete ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onDelete(allocation)}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete allocation</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
