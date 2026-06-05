import { describe, expect, it } from "vitest";

import { getBillingAccessState, hasMutationAccess, type BillingEntitlement } from "@/lib/billing/access";

const now = new Date("2026-06-05T12:00:00.000Z");

function entitlement(values: Partial<BillingEntitlement>): BillingEntitlement {
  return {
    user_id: "user-1",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    trial_end: null,
    current_period_end: null,
    cancel_at_period_end: false,
    access_override: null,
    ...values,
  };
}

describe("billing access", () => {
  it("allows owner overrides", () => {
    expect(hasMutationAccess(entitlement({ access_override: "always_paid" }), now)).toBe(true);
    expect(getBillingAccessState(entitlement({ access_override: "always_paid" }), now)).toBe("always_paid");
  });

  it("allows active and trialing subscriptions", () => {
    expect(hasMutationAccess(entitlement({ subscription_status: "active" }), now)).toBe(true);
    expect(hasMutationAccess(entitlement({ subscription_status: "trialing" }), now)).toBe(true);
  });

  it("keeps access while cancellation is inside the paid period", () => {
    const row = entitlement({
      subscription_status: "active",
      cancel_at_period_end: true,
      current_period_end: "2026-07-05T12:00:00.000Z",
    });

    expect(hasMutationAccess(row, now)).toBe(true);
    expect(getBillingAccessState(row, now)).toBe("canceling");
  });

  it("blocks missing, unpaid, paused, canceled, and expired entitlements", () => {
    expect(hasMutationAccess(null, now)).toBe(false);
    expect(hasMutationAccess(entitlement({ subscription_status: "unpaid" }), now)).toBe(false);
    expect(hasMutationAccess(entitlement({ subscription_status: "paused" }), now)).toBe(false);
    expect(hasMutationAccess(entitlement({ subscription_status: "canceled" }), now)).toBe(false);
    expect(
      hasMutationAccess(
        entitlement({
          subscription_status: "active",
          current_period_end: "2026-06-01T12:00:00.000Z",
        }),
        now,
      ),
    ).toBe(false);
  });
});
