import { Badge } from "@/components/ui/badge";
import { getAccountGroup, getAccountTypeLabel } from "@/features/accounts/lib/account-utils";
import type { AccountType } from "@/types/finance";

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const variant = getAccountGroup(type) === "debt" ? "destructive" : "secondary";

  return (
    <Badge variant={variant} className="rounded-sm px-1.5 py-0 text-[10px] font-medium uppercase tracking-[0.14em]">
      {getAccountTypeLabel(type)}
    </Badge>
  );
}
