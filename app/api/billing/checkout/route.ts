import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { localizedErrorResponse } from "@/app/api/_lib/error-response";
import { getMoniqStripePriceId, getStripe } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { routing, type AppLocale } from "@/i18n/routing";

const checkoutSchema = z.object({
  locale: z.enum(["en", "ru"]).optional(),
});

function getOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

async function getOrCreateStripeCustomer(user: { id: string; email?: string | null }) {
  const service = createServiceClient();
  const { data: entitlement, error: entitlementError } = await service
    .from("user_billing_entitlements")
    .select("stripe_customer_id, stripe_subscription_id, trial_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (entitlementError) {
    throw new Error(entitlementError.message);
  }

  const existing = entitlement as {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    trial_end?: string | null;
  } | null;
  const existingCustomerId = existing?.stripe_customer_id;
  if (existingCustomerId) {
    return {
      customerId: existingCustomerId,
      hasUsedTrial: Boolean(existing?.stripe_subscription_id || existing?.trial_end),
    };
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id },
  });

  const { error } = await service.from("user_billing_entitlements").upsert(
    {
      user_id: user.id,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(error.message);
  }

  return { customerId: customer.id, hasUsedTrial: false };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return localizedErrorResponse(request, "common.errors.unauthorized", 401);
  }

  try {
    const body = checkoutSchema.parse(await request.json().catch(() => ({})));
    const locale = (body.locale ?? routing.defaultLocale) as AppLocale;
    const origin = getOrigin(request);
    const stripe = getStripe();
    const { customerId, hasUsedTrial } = await getOrCreateStripeCustomer(user);
    const settingsUrl = `${origin}/${locale}/settings`;
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { user_id: user.id },
    };
    if (!hasUsedTrial) {
      subscriptionData.trial_period_days = 30;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getMoniqStripePriceId(), quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: subscriptionData,
      metadata: { user_id: user.id },
      success_url: `${settingsUrl}?billing=success`,
      cancel_url: `${settingsUrl}?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return localizedErrorResponse(request, "common.errors.billing.checkout", 400);
  }
}
