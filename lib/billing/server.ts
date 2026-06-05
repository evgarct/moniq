import "server-only";

import { BillingAccessError, type BillingEntitlement, hasMutationAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";

export async function getBillingEntitlementForUser(userId: string): Promise<BillingEntitlement | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_billing_entitlements")
    .select(
      "user_id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_end, current_period_end, cancel_at_period_end, access_override",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BillingEntitlement | null) ?? null;
}

export async function requireMutationEntitlementForUser(userId: string) {
  const entitlement = await getBillingEntitlementForUser(userId);
  if (!hasMutationAccess(entitlement)) {
    throw new BillingAccessError();
  }

  return entitlement;
}

export async function requireMutationEntitlementForRequest(_request?: Request) {
  void _request;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  await requireMutationEntitlementForUser(user.id);
  return user;
}
