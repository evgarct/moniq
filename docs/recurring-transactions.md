# Recurring transaction editing

Materialization, stable occurrence identity, explicit rescheduling and source-goal semantics are specified in [Debt and recurring reliability](debt-recurring-reliability.md).

## Cadence

A schedule repeats "every N days / weeks / months", stored as `interval_count` + `interval_unit`. The form offers the presets (daily, weekly, monthly, every 3 months, yearly) and **Custom…**, which reveals a number and a unit (for example every 9 days, or every 3 months). Month-based cadences keep the first occurrence's day of month and clamp to the end of shorter months (31 Jan → 30 Apr with a 3-month cadence). The same cadence is available through the MCP recurring-transaction tools (`create/get/update/delete_recurring_transaction_schedule` and their aliases) as `frequency: "custom"` with `interval_count` and `interval_unit`.

## Editing

Editing a single planned recurring occurrence always asks the user to choose the change scope after client-side validation:

- **Only this transaction** updates the selected occurrence and keeps it as a schedule override.
- **This and all following** applies only the changed fields to the selected and later planned occurrences and updates the schedule template.

The series update uses `schedule_occurrence_date` as its stable pivot. Earlier occurrences and every paid transaction remain unchanged. Existing planned overrides at or after the pivot are intentionally replaced and reset to ordinary schedule occurrences. A date change shifts the selected and later planned occurrence dates by the same offset and moves the schedule anchor by that offset.

The client computes a normalized field patch and sends one `update-from-occurrence` mutation through `FinanceMutationCoordinator`. The database RPC applies the template and planned-occurrence changes atomically; the normal schedule reconciliation then extends the updated series through the active snapshot horizon.

Quick actions, deletion, payment, skipping, pause/resume, and explicit **Edit series** actions keep their existing behavior and do not show the change-scope prompt.

**Reschedule** (context menu: Tomorrow / In 3 days / In 1 week / Pick a date…) moves **only the selected occurrence**. It is a plain transaction update that flags the occurrence as an override, so `schedule_occurrence_date` (the slot key) is unchanged, later occurrences stay on their own dates, and the reconciler does not regenerate or overwrite it. To shift the whole series use **Edit occurrence** and choose "This and following".
