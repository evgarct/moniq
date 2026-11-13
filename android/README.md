# Moniq for Android

The native Moniq app (`com.evgarct.moniq`): Today, Balance, wallet history, the transaction
form, the Hermes chat and Google Wallet payment capture. Kotlin and Jetpack Compose, one module.

Product and design notes live in [`docs/android-app.md`](../docs/android-app.md).

## Setup

1. Copy `local.properties.example` to `local.properties` (gitignored) and fill it in:
   - `moniq.api.url`: the Moniq backend (`https://moniq.fyi`)
   - `moniq.supabase.url`, `moniq.supabase.anonKey`: the Supabase project behind it
   - `hermes.api.url`, `hermes.api.key`: the Hermes API server. Leave both empty to build without the chat backend.
   - `wallet.cards`: `last4:Wallet name` pairs for the cards whose payments go to Hermes
2. Build, install and prepare the phone with `scripts/android-debug.ps1` (same workflow as
   `C:\Projects\Form\scripts\android-debug.ps1`; pairing runbook in `C:\Projects\Form\docs\ANDROID_DEBUGGING.md`):

   ```powershell
   .\scripts\android-debug.ps1 -Action Devices
   .\scripts\android-debug.ps1 -Action BuildAndInstall
   .\scripts\android-debug.ps1 -Action GrantNotificationAccess
   .\scripts\android-debug.ps1 -Action Launch
   ```

## Layout

| Path | What it holds |
| --- | --- |
| `data/` | Models of the finance snapshot, the HTTP layer (Supabase Auth, Moniq API, Hermes stream), the session, and `Repo` with its disk cache and optimistic mutations |
| `domain/Finance.kt` | Pure selectors and money formatting. Amounts in different currencies are never summed |
| `wallet/` | Google Wallet capture: notification listener, card and repeat gates, the worker that hands a payment to Hermes, notifications |
| `ui/` | Theme tokens, motion vocabulary, icons, shared components and every screen |

`res/font` bundles Newsreader and Inter (variable fonts from the Google Fonts repository, SIL Open
Font License 1.1). `ui/CategoryIcons.kt` is generated from the lucide icons the web `CATEGORY_ICON_MAP` uses. When that
map changes, regenerate it instead of editing by hand.

## Data

The app is a client of the same `/api/*` routes as the web app. It signs in with Supabase Auth and
sends `Authorization: Bearer <access token>` with `X-Moniq-Client: android`. The finance snapshot is
the single source of truth: the last answer is cached on disk for an instant cold start and every
mutation returns a fresh snapshot. Mutations are optimistic and roll back to server truth on failure.

## Google Wallet capture

`WalletNotificationListenerService` reads payment notifications of `com.google.android.apps.walletnfcrel`.
The app hands each payment to Hermes, which records it in Moniq on its own with its
`moniq-wallet-import` skill: it reconciles the payment against the ledger, marks a matching plan paid
or creates a new paid expense, and picks the category. Nothing asks the user to confirm.

The app keeps only the deterministic gates (`CaptureRules`), which an LLM should not be trusted with:

- only a card linked to a Moniq wallet is handed over; a payment from any other card is not sent, and
  You offers to link that card to a wallet once
- an exact repeat of a notification is dropped by its id
- an equivalent card, merchant and amount within 120 seconds is handed over read-only

`CaptureWorker` sends one non-streamed turn per notification with a stable session id and an
`Idempotency-Key`, so a retry after a lost answer replays Hermes's first reply instead of recording
twice. The user takes no part: whatever Hermes answers is shown as its message in the Hermes chat
(under a "Google Wallet" label) and as a notification that opens the chat. If Hermes cannot be
reached after the retries, that is reported the same way. The skill's trailing `::status` line is
stripped before display.

To exercise the pipeline on a debug build: a test notification is always handed over read-only, so
it reaches Hermes but can never write to the ledger.

```powershell
.\scripts\android-debug.ps1 -Action TestWalletNotification -Code "Test Shop" -OutputPath "12,00 Kč with Mastercard 5583"
```

## Hermes

The chat talks to the Hermes gateway's OpenAI-compatible API (`/v1/chat/completions`, streamed).
The first turn of a conversation carries a short brief; later turns send `X-Hermes-Session-Id` so
Hermes continues its own transcript. `hermes.safronov.dev` resolves to a Tailscale address, so the
phone has to be on the tailnet for the chat to connect.
