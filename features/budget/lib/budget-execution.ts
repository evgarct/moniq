import type { Transaction } from "@/types/finance";

type Lot = { origin: Transaction; remaining: number; rate: number };
export type BudgetExecution = { transactions: Transaction[]; lots: { origin_id: string; pool: string; remaining: number; category_id: string | null }[] };
const round = (value: number) => Number(value.toFixed(8));
const pool = (wallet: string | null, goal?: string | null) => goal ? `goal:${goal}` : `wallet:${wallet}`;

/** Replay the persisted ledger, never a second balance ledger. FIFO provenance survives goal moves.
 * Returned expense projections belong ONLY to envelopes; cashflow/reporting uses original transactions.
 */
export function buildBudgetExecution(history: Transaction[]): BudgetExecution {
  const pools = new Map<string, Lot[]>();
  const projected: Transaction[] = [];
  const get = (key: string) => { if (!pools.has(key)) pools.set(key, []); return pools.get(key)!; };
  const take = (key: string, amount: number, origin?: string) => {
    const taken: Lot[] = [];
    for (const lot of get(key)) {
      if (amount <= 0) break;
      if (origin && lot.origin.id !== origin) continue;
      const part = Math.min(amount, lot.remaining);
      if (part > 0) { taken.push({ ...lot, remaining: part }); lot.remaining = round(lot.remaining - part); amount = round(amount - part); }
    }
    return taken;
  };
  const sorted = [...history].filter((t) => t.status !== "skipped").sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at) || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  const releases = new Map<string, Transaction[]>();
  for (const tx of sorted) if (tx.system_generated && tx.linked_transaction_id) releases.set(tx.linked_transaction_id, [...(releases.get(tx.linked_transaction_id) ?? []), tx]);
  const ordered = sorted.filter((tx) => !tx.system_generated).flatMap((tx) => [...(releases.get(tx.id) ?? []), tx]);
  // Planned operations use a copy of the confirmed provenance: never consume paid lots for future forecasts.
  for (const status of ["paid", "planned"] as const) {
    const confirmed = new Map([...pools].map(([key, lots]) => [key, lots.map((lot) => ({ ...lot }))]));
    for (const tx of ordered.filter((item) => item.status === status)) {
      // Accept an already projected signed return when screen/detail helpers share the projection.
      if (tx.kind === "expense" && tx.amount < 0) { projected.push(tx); continue; }
      const source = pool(tx.source_account_id, tx.source_allocation_id);
      const destination = pool(tx.destination_account_id, tx.allocation_id);
      if (tx.kind === "transfer") {
        const funding = !!tx.category_id && (!!tx.allocation_id || tx.destination_account?.type === "pension") && !tx.system_generated;
        // A categorized contribution from general cash is an explicit new budget commitment.
        // Only a transfer directly out of a goal carries its earlier execution into another goal.
        const newCommitment = funding && !tx.source_allocation_id;
        const isReturn = !tx.system_generated && !!tx.linked_transaction_id && !!tx.source_allocation_id && !tx.allocation_id;
        const moved = take(source, tx.amount, isReturn ? tx.linked_transaction_id! : undefined);
        const covered = moved.reduce((sum, lot) => sum + lot.remaining, 0);
        if (isReturn) {
          for (const lot of moved) projected.push({ ...tx, id: `${tx.id}:${lot.origin.id}`, kind: "expense", category_id: lot.origin.category_id, amount: -lot.remaining * lot.rate, source_account: lot.origin.source_account });
        } else if (!newCommitment) {
          const fx = tx.amount ? (tx.destination_amount ?? tx.amount) / tx.amount : 1;
          get(destination).push(...moved.map((lot) => ({ ...lot, remaining: lot.remaining * fx, rate: lot.rate / fx })));
        }
        const fresh = isReturn ? 0 : newCommitment ? tx.amount : Math.max(0, tx.amount - covered);
        if (funding && fresh > 0) {
          const fx = tx.amount ? (tx.destination_amount ?? tx.amount) / tx.amount : 1;
          get(destination).push({ origin: tx, remaining: fresh * fx, rate: 1 / fx });
          projected.push({ ...tx, kind: "expense", amount: fresh });
        }
      } else if (tx.kind === "expense") {
        const used = take(source, tx.amount).reduce((sum, lot) => sum + lot.remaining, 0);
        if (tx.amount - used > 0.000001) projected.push({ ...tx, amount: round(tx.amount - used) });
      } else projected.push(tx);
    }
    if (status === "planned") { pools.clear(); for (const [key, lots] of confirmed) pools.set(key, lots); }
  }
  return { transactions: projected, lots: [...pools].flatMap(([key, lots]) => lots.filter((lot) => lot.remaining > 0).map((lot) => ({ origin_id: lot.origin.id, pool: key, remaining: lot.remaining, category_id: lot.origin.category_id }))) };
}
