export type GoalHistoryEntry = {
  id: string;
  occurred_at: string;
  title: string;
  kind: "income" | "expense" | "transfer" | "debt_payment";
  /** in: money added to the goal; out: money taken from it (withdrawal, goal-to-goal move out, or an expense paid from it). */
  direction: "in" | "out";
  amount: number;
  currency: string | null;
  note: string | null;
};

export type GoalHistoryMonth = {
  month: string;
  added: number;
  withdrawn: number;
  spent: number;
  net: number;
};

export type GoalReconciliation = {
  /** The goal's current amount. */
  current_amount: number;
  /** Net of all recorded paid movements of the goal (added - withdrawn - spent), over the whole history. */
  tracked_net: number;
  /** current_amount - tracked_net: balance that no transaction explains (opening amount or manual balance edits). */
  untracked_difference: number;
};

export type GoalHistory = {
  goal_id: string;
  months: GoalHistoryMonth[];
  totals: { added: number; withdrawn: number; spent: number; net: number };
  entries: GoalHistoryEntry[];
  entries_truncated: boolean;
  reconciliation: GoalReconciliation | null;
};

export const GOAL_HISTORY_ENTRY_LIMIT = 100;

/** Net effect of every paid movement of the goal in the given rows (no month window). */
export function summarizeGoalNet(goalId: string, rows: Record<string, unknown>[]) {
  let net = 0;
  for (const row of rows) {
    if (row.status !== "paid") continue;
    const kind = row.kind;
    if (row.source_allocation_id === goalId && kind === "transfer") net -= num(row.amount);
    if (row.destination_allocation_id === goalId) {
      if (kind === "expense") net -= num(row.amount);
      else if (kind === "transfer") net += num(row.destination_amount ?? row.amount);
      else if (kind === "income") net += num(row.amount);
    }
  }
  return round2(net);
}

export function reconcileGoal(goalId: string, currentAmount: number, allRows: Record<string, unknown>[]): GoalReconciliation {
  const trackedNet = summarizeGoalNet(goalId, allRows);
  return {
    current_amount: round2(currentAmount),
    tracked_net: trackedNet,
    untracked_difference: round2(currentAmount - trackedNet),
  };
}

type RawTransaction = Record<string, unknown>;

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Builds a goal's monthly contribution history from paid transactions (rows of mcp_get_transactions_for_period).
 * The goal tag on income/transfers adds, the goal tag on an expense subtracts (spent), and a transfer's
 * source goal subtracts (withdrawn), mirroring sync_wallet_balance_on_transaction(). Every amount is in the
 * currency of the goal's savings wallet (the money always moves through that wallet).
 */
export function buildGoalHistory(goalId: string, months: string[], rows: RawTransaction[], currency: string | null = null): GoalHistory {
  const byMonth = new Map(months.map((month) => [month, { month, added: 0, withdrawn: 0, spent: 0, net: 0 }]));
  const entries: GoalHistoryEntry[] = [];

  for (const row of rows) {
    if (row.status !== "paid") continue;
    const kind = row.kind as GoalHistoryEntry["kind"];
    const occurredAt = String(row.occurred_at ?? "");
    const bucket = byMonth.get(occurredAt.slice(0, 7));
    if (!bucket) continue;

    const isDestinationGoal = row.destination_allocation_id === goalId;
    const isSourceGoal = row.source_allocation_id === goalId;
    if (!isDestinationGoal && !isSourceGoal) continue;

    const base = {
      id: String(row.id),
      occurred_at: occurredAt,
      title: String(row.title ?? ""),
      kind,
      note: typeof row.note === "string" ? row.note : null,
    };

    if (isSourceGoal && kind === "transfer") {
      const amount = num(row.amount);
      bucket.withdrawn += amount;
      entries.push({ ...base, direction: "out", amount, currency });
    }

    if (isDestinationGoal) {
      if (kind === "expense") {
        const amount = num(row.amount);
        bucket.spent += amount;
        entries.push({ ...base, direction: "out", amount, currency });
      } else if (kind === "transfer" || kind === "income") {
        const amount = kind === "transfer" ? num(row.destination_amount ?? row.amount) : num(row.amount);
        bucket.added += amount;
        entries.push({ ...base, direction: "in", amount, currency });
      }
    }
  }

  const monthsList = Array.from(byMonth.values()).map((bucket) => ({
    month: bucket.month,
    added: round2(bucket.added),
    withdrawn: round2(bucket.withdrawn),
    spent: round2(bucket.spent),
    net: round2(bucket.added - bucket.withdrawn - bucket.spent),
  }));
  const totals = monthsList.reduce(
    (sum, item) => ({
      added: round2(sum.added + item.added),
      withdrawn: round2(sum.withdrawn + item.withdrawn),
      spent: round2(sum.spent + item.spent),
      net: round2(sum.net + item.net),
    }),
    { added: 0, withdrawn: 0, spent: 0, net: 0 },
  );
  const sorted = entries.sort((left, right) => right.occurred_at.localeCompare(left.occurred_at) || right.id.localeCompare(left.id));

  return {
    goal_id: goalId,
    months: monthsList,
    totals,
    entries: sorted.slice(0, GOAL_HISTORY_ENTRY_LIMIT),
    entries_truncated: sorted.length > GOAL_HISTORY_ENTRY_LIMIT,
    reconciliation: null,
  };
}
