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
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/18 py-3">
      <div className="min-w-0 pr-4">
        <p className="truncate text-[15px] font-semibold text-white">{allocation.name}</p>
        <p className="text-[11px] text-cyan-200/85">Reserved inside this savings account</p>
      </div>
      <div className="justify-self-end rounded-[4px] bg-amber-400 px-3 py-1.5 text-right font-mono text-[15px] font-semibold text-slate-900 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <MoneyAmount amount={allocation.amount} currency={currency} display="absolute" className="text-[15px] font-semibold text-slate-900" />
      </div>
      <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-sm justify-self-end text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => onEdit(allocation)}>
        <PencilLine className="h-3.5 w-3.5" />
        <span className="sr-only">Edit allocation</span>
      </Button>
    </div>
  );
}
