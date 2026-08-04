# Recurring transaction editing

Editing a single planned recurring occurrence always asks the user to choose the change scope after client-side validation:

- **Only this transaction** updates the selected occurrence and keeps it as a schedule override.
- **This and all following** applies only the changed fields to the selected and later planned occurrences and updates the schedule template.

The series update uses `schedule_occurrence_date` as its stable pivot. Earlier occurrences and every paid transaction remain unchanged. Existing planned overrides at or after the pivot are intentionally replaced and reset to ordinary schedule occurrences. A date change shifts the selected and later planned occurrence dates by the same offset and moves the schedule anchor by that offset.

The client computes a normalized field patch and sends one `update-from-occurrence` mutation through `FinanceMutationCoordinator`. The database RPC applies the template and planned-occurrence changes atomically; the normal schedule reconciliation then extends the updated series through the active snapshot horizon.

Quick actions, deletion, payment, skipping, pause/resume, and explicit **Edit series** actions keep their existing behavior and do not show the change-scope prompt.
