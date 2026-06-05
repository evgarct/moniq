import { NextResponse } from "next/server";
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
  const { data: entitlement } = await service
    .from("user_billing_entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const existingCustomerId = (entitlement as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id },
  });

  await service.from("user_billing_entitlements").upsert(
    {
      user_id: user.id,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return customer.id;
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
    const customerId = await getOrCreateStripeCustomer(user);
    const settingsUrl = `${origin}/${locale}/settings`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getMoniqStripePriceId(), quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: 30,
        metadata: { user_id: user.id },
      },
      metadata: { user_id: user.id },
      success_url: `${settingsUrl}?billing=success`,
      cancel_url: `${settingsUrl}?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return localizedErrorResponse(request, "common.errors.billing.checkout", 400);
  }
}
