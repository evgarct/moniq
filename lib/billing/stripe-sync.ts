import "server-only";

import type Stripe from "stripe";

import { getStripeCustomerId, mapStripeSubscription } from "@/lib/billing/stripe-mapping";
import { createServiceClient } from "@/lib/supabase/service";

export { mapStripeSubscription } from "@/lib/billing/stripe-mapping";

export async function upsertEntitlementFromCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  const customerId = getStripeCustomerId(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  if (!userId || !customerId) {
    return;
  }

  const supabase = createServiceClient();
  await supabase.from("user_billing_entitlements").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function upsertEntitlementFromSubscription(subscription: Stripe.Subscription) {
  const customerId = getStripeCustomerId(subscription.customer);
  if (!customerId) return;

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("user_billing_entitlements")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const userId = (existing as { user_id?: string } | null)?.user_id ?? subscription.metadata?.user_id;
  if (!userId) return;

  await supabase.from("user_billing_entitlements").upsert(
    {
      user_id: userId,
      ...mapStripeSubscription(subscription),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
