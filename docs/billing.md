# Billing

Moniq uses Stripe Billing for mutation access. Users without an active entitlement keep read-only access to the app and MCP read tools, but write paths return payment-required errors.

## Stripe Setup

- Product: `Moniq`
- Price: `price_1Tf3ZrLhHw88XUx9MZAGw5HU`
- Amount: `200` minor units, `EUR`, monthly recurring
- Checkout mode: `subscription`
- Trial: `30` days, payment method collected before trial start

Required runtime environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONIQ_PRICE_ID`
- `NEXT_PUBLIC_APP_URL`

## Entitlements

Billing state is stored in `public.user_billing_entitlements`. Mutation access is allowed when:

- `access_override = 'always_paid'`
- Stripe status is `active`
- Stripe status is `trialing`
- the subscription is canceling but the current paid period has not ended

The owner account `isafronovms@gmail.com` is seeded with `always_paid`. The e2e account `codex-e2e@moniq.safronov.dev` is seeded with an active test entitlement by `scripts/ensure-e2e-user.mjs`.

## Webhooks

`POST /api/billing/webhook` verifies the Stripe signature and syncs entitlements from subscription, checkout, and invoice events. Cancellation does not block mutation access until the paid period has ended.
