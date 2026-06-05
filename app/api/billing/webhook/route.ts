import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import {
  upsertEntitlementFromCheckoutSession,
  upsertEntitlementFromSubscription,
} from "@/lib/billing/stripe-sync";

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  await upsertEntitlementFromSubscription(subscription);
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (typeof subscription === "string") return subscription;
  return subscription?.id ?? null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await upsertEntitlementFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await handleSubscriptionEvent(await stripe.subscriptions.retrieve(subscriptionId));
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
