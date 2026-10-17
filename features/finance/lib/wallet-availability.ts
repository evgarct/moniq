/** Shared MCP liquidity contract. Goals reserve money; borrowing capacity is never cash. */
export function walletAvailability(
  wallet: { id: unknown; type: unknown; balance: unknown },
  goals: { id?: unknown; wallet_id?: unknown; name?: unknown; amount?: unknown }[],
) {
  const total = Number(wallet.balance);
  if (!Number.isFinite(total)) return { total_balance: null, reserved_balance: null, available_to_spend: null, allocations: [], availability_status: "unavailable" };
  const allocations = goals.filter((goal) => goal.wallet_id === wallet.id).map((goal) => ({
    id: goal.id, name: goal.name, amount: Number(goal.amount), availability: "reserved" as const,
  }));
  const liability = wallet.type === "debt" || wallet.type === "credit_card";
  const reserved = liability ? null : wallet.type === "pension" ? total : allocations.reduce((sum, goal) => sum + goal.amount, 0);
  const available = liability || wallet.type === "pension" ? 0 : Number((total - (reserved ?? 0)).toFixed(2));
  return {
    total_balance: total,
    reserved_balance: reserved === null ? null : Number(reserved.toFixed(2)),
    available_to_spend: available,
    allocations,
    availability_status: liability ? "liability" : wallet.type === "pension" ? "locked_until_retirement" : available < 0 ? "overallocated" : "available",
  };
}
