import "server-only";

import Stripe from "stripe";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
  });
}

export function getMoniqStripePriceId() {
  const priceId = process.env.STRIPE_MONIQ_PRICE_ID;
  if (!priceId) {
    throw new Error("Missing STRIPE_MONIQ_PRICE_ID.");
  }

  return priceId;
}
