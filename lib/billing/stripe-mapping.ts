import type Stripe from "stripe";

import type { BillingSubscriptionStatus } from "@/lib/billing/access";

function timestampToIso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => typeof value === "number");

  return periodEnds.length > 0 ? Math.max(...periodEnds) : null;
}

export function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export function mapStripeSubscription(subscription: Stripe.Subscription) {
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: getStripeCustomerId(subscription.customer),
    subscription_status: subscription.status as BillingSubscriptionStatus,
    trial_end: timestampToIso(subscription.trial_end),
    current_period_end: timestampToIso(getSubscriptionCurrentPeriodEnd(subscription)),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  };
}
