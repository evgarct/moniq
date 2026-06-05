import { NextResponse } from "next/server";
import { z } from "zod";

import { localizedErrorResponse } from "@/app/api/_lib/error-response";
import { getStripe } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { routing, type AppLocale } from "@/i18n/routing";

const portalSchema = z.object({
  locale: z.enum(["en", "ru"]).optional(),
});

function getOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
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
    const body = portalSchema.parse(await request.json().catch(() => ({})));
    const locale = (body.locale ?? routing.defaultLocale) as AppLocale;
    const service = createServiceClient();
    const { data } = await service
      .from("user_billing_entitlements")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;

    if (!customerId) {
      return localizedErrorResponse(request, "common.errors.billing.customerMissing", 400);
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getOrigin(request)}/${locale}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return localizedErrorResponse(request, "common.errors.billing.portal", 400);
  }
}
