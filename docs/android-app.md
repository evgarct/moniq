# Moniq for Android

Native app in `android/` (`com.evgarct.moniq`), built from the "Moniq Android v1" design canvas.
Setup and code layout: [`android/README.md`](../android/README.md).

## Screens

| Screen | What it shows | Data |
| --- | --- | --- |
| Sign in | Brand photo with Ken Burns and film grain, email and password sheet | Supabase Auth |
| Today | Date, month calendar, a four-day strip, the day's Planned and Confirmed lists | snapshot transactions |
| Balance | Cash, Goals (savings wallets with free balance and goal progress), Credit and debt, Investments (pension wallets and positions) | snapshot accounts, allocations, positions |
| Wallet history | A wallet's balance and its paid entries for a month, grouped by day | snapshot transactions |
| Transaction form | Expense, income, transfer (including two currencies), debt payment; paid or planned; repeat and end date | `POST/PATCH /api/transactions`, `PATCH /api/transaction-schedules/{id}` |
| Hermes | Chat with the Hermes agent, streamed, with fact rows; Hermes's reports about Google Wallet payments appear here on their own | Hermes API server |
| You | Google Wallet capture status, card rules, capture log, fingerprint lock, sign out | device storage |

## Behaviour worth knowing

- **Today's list** carries every overdue plan on today's date, marked "Overdue", so nothing planned can fall off screen. The word "Today" appears once, in the headline; the list is only titled when another day is selected.
- **Not on Today for now**: the "still planned" total and the AI shortfall note from the canvas were removed at the owner's request to keep the start screen open.
- **Row actions**: tap opens the action sheet. Swipe right marks a plan paid; swipe left skips a recurring occurrence.
- **Deleting** asks for a second tap. A recurring entry offers Skip, Edit occurrence, Edit series, Pause or Resume, and Delete series.
- **Debt payments** to a loan or mortgage take principal and interest as two amounts; a credit card takes one.
- **Amounts** show cents only when they exist. Totals never mix currencies.
- **Fingerprint lock** is off by default and is switched on in You.

## Motion

Durations and curves are quoted from the canvas and live in `ui/Motion.kt`: rise 750 ms, sheets 600 ms,
sliding indicators 550 ms with one overshoot, count-up 1.2 s, chat reveal 750 ms as a circle from the
Hermes button, login flood 700 ms then a 550 ms fade. All of it is skipped when the system animation
scale is zero.

## Google Wallet capture

The app captures the notification and hands it to Hermes with no step for the user. Hermes records the
payment on its own, and its answer appears as a message in the Hermes chat and as a notification; see
the README for the gates. This replaced
the standalone `com.evgarct.moniqwallet` forwarder, the Hermes `wallet` webhook route with its filter
script, and the Telegram reply. The `moniq-wallet-import` skill stays on the Hermes server (v2).

## Not in this version

- Google sign-in and passkeys: the backend offers email and password only.
- Creating or editing wallets, goals, categories and budgets: use the web app.
- Investment purchases and transfers into pension wallets from the form.
