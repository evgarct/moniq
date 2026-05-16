import { getAccountTypeLabel } from "@/features/accounts/lib/account-utils";
import type { AccountType } from "@/types/finance";

export function AccountTypeBadge({ type }: { type: AccountType }) {
  return <span className="type-body-12 capitalize text-muted-foreground">{getAccountTypeLabel(type)}</span>;
}
