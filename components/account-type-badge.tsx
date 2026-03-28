import { Badge } from "@/components/ui/badge";
import { getAccountGroup, getAccountTypeLabel } from "@/features/accounts/lib/account-utils";
import type { AccountType } from "@/types/finance";

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const variant = getAccountGroup(type) === "debt" ? "destructive" : "secondary";

  return (
    <Badge variant={variant} className="rounded-full capitalize">
      {getAccountTypeLabel(type)}
    </Badge>
  );
}
