import { EmptyState } from "@/components/empty-state";
import { AllocationItem } from "@/features/allocations/components/allocation-item";
import type { Allocation } from "@/types/finance";

export function AllocationList({
  allocations,
  currency,
  onEdit,
}: {
  allocations: Allocation[];
  currency: string;
  onEdit: (allocation: Allocation) => void;
}) {
  if (!allocations.length) {
    return (
      <EmptyState
        title="No allocations yet"
        description="Create your first allocation to reserve money inside this savings account."
      />
    );
  }

  return (
    <div className="border-t border-border/70">
      {allocations.map((allocation) => (
        <AllocationItem
          key={allocation.id}
          allocation={allocation}
          currency={currency}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
