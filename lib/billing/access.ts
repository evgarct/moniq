export const BILLING_ACCESS_ERROR_MESSAGE = "Mutation access requires an active Moniq subscription.";

export type BillingAccessOverride = "always_paid";

export type BillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unpaid";

export type BillingEntitlement = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: BillingSubscriptionStatus | string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  access_override: BillingAccessOverride | null;
};

export type BillingAccessState =
  | "always_paid"
  | "active"
  | "trialing"
  | "canceling"
  | "blocked";

export function hasMutationAccess(
  entitlement: Pick<
    BillingEntitlement,
    "access_override" | "subscription_status" | "current_period_end" | "cancel_at_period_end"
  > | null,
  now = new Date(),
) {
  if (!entitlement) return false;
  if (entitlement.access_override === "always_paid") return true;
  if (entitlement.subscription_status !== "active" && entitlement.subscription_status !== "trialing") return false;
  if (!entitlement.current_period_end) return true;
  return new Date(entitlement.current_period_end).getTime() > now.getTime();
}

export function getBillingAccessState(
  entitlement: Pick<
    BillingEntitlement,
    "access_override" | "subscription_status" | "current_period_end" | "cancel_at_period_end"
  > | null,
  now = new Date(),
): BillingAccessState {
  if (!entitlement) return "blocked";
  if (entitlement.access_override === "always_paid") return "always_paid";
  if (
    entitlement.cancel_at_period_end &&
    entitlement.current_period_end &&
    new Date(entitlement.current_period_end).getTime() > now.getTime() &&
    (entitlement.subscription_status === "active" || entitlement.subscription_status === "trialing")
  ) {
    return "canceling";
  }
  const currentPeriodEnd = entitlement.current_period_end
    ? new Date(entitlement.current_period_end).getTime()
    : Number.POSITIVE_INFINITY;
  if (currentPeriodEnd <= now.getTime()) return "blocked";
  if (entitlement.subscription_status === "trialing") return "trialing";
  if (entitlement.subscription_status === "active") return "active";
  return "blocked";
}

export class BillingAccessError extends Error {
  constructor() {
    super(BILLING_ACCESS_ERROR_MESSAGE);
    this.name = "BillingAccessError";
  }
}

export function isBillingAccessError(error: unknown) {
  return error instanceof Error && error.message === BILLING_ACCESS_ERROR_MESSAGE;
}
