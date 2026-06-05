import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { mapStripeSubscription } from "@/lib/billing/stripe-mapping";

describe("Stripe subscription mapping", () => {
  it("maps subscription fields into Moniq entitlement fields", () => {
    const subscription = {
      id: "sub_123",
      customer: "cus_123",
      status: "trialing",
      trial_end: 1783252800,
      items: { data: [{ current_period_end: 1785844800 }] },
      cancel_at_period_end: true,
    } as Stripe.Subscription;

    expect(mapStripeSubscription(subscription)).toEqual({
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
      subscription_status: "trialing",
      trial_end: "2026-07-05T12:00:00.000Z",
      current_period_end: "2026-08-04T12:00:00.000Z",
      cancel_at_period_end: true,
    });
  });
});
