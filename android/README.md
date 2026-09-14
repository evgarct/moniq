# Moniq Wallet (Android)

Minimal notification-capture app: listens for Google Wallet payment push notifications and
forwards the raw title/text to Gabi's `/api/wallet-notification` webhook
(`C:\Projects\telegram-bot`), which does the actual parsing (Gemini) and Moniq write via
`create_transactions`. This app does no parsing itself — see the parent repo's design
decision in `docs/` or the approved plan for why.

## Setup

1. Copy `local.properties.example` → `local.properties` (gitignored) and fill in:
   - `sdk.dir` — your Android SDK path
   - `wallet.webhook.url` — `https://form-telegram-bot.vercel.app/api/wallet-notification`
   - `wallet.webhook.secret` — matches `WALLET_WEBHOOK_SECRET` in `telegram-bot/.env.local`
2. Build + connect + install: use `scripts/android-debug.ps1` (same tool/workflow as
   `C:\Projects\Form\scripts\android-debug.ps1` — see
   `C:\Projects\Form\docs\ANDROID_DEBUGGING.md` for the full pairing/USB runbook and
   known gotchas). Quick reference:
   ```powershell
   .\scripts\android-debug.ps1 -Action Devices
   # Wireless: pair once (code shown on phone under Settings > Developer options >
   # Wireless debugging > Pair device with pairing code), then connect each session:
   .\scripts\android-debug.ps1 -Action Pair -Ip <ip> -Port <pairing_port> -Code <code>
   .\scripts\android-debug.ps1 -Action Connect -Ip <ip> -Port <connect_port>
   .\scripts\android-debug.ps1 -Action BuildAndInstall
   .\scripts\android-debug.ps1 -Action GrantNotificationAccess
   .\scripts\android-debug.ps1 -Action Launch
   ```

## ⚠️ Verify the Wallet package name before relying on this

`WalletNotificationListenerService.WALLET_PACKAGE` is currently set to
`com.google.android.apps.walletnfcrel` (Google Pay/Wallet's historical package name) — this
has **not** been confirmed on the actual Pixel 11 Pro XL yet. Google has rebranded/repackaged
this app before. To confirm on-device:

```powershell
.\scripts\android-debug.ps1 -Action DumpNotifications
```

...while a real Wallet payment notification is showing, and look for the `pkg=` of that
notification's entry. Update `WALLET_PACKAGE` if it differs.

## How it works

1. `WalletNotificationListenerService` (a `NotificationListenerService`) filters incoming
   notifications by package, extracts title/text, and enqueues a one-shot `WorkManager` job
   (survives process death, retries with backoff when offline — mirrors Form's
   `ActivitySyncWorker` pattern).
2. `WalletNotificationForwardWorker` POSTs `{ title, text, postedAt }` to the webhook with a
   `Authorization: Bearer <secret>` header, and records the outcome in
   `CapturedNotificationLog` (also used to de-dupe re-posted notifications within a 10-minute
   window).
3. `MainActivity` shows notification-access status and a log of recently captured/forwarded
   notifications, for sanity-checking.
