import type { FinanceSnapshot, InvestmentInstrumentCandidate, InvestmentPosition, Transaction } from "@/types/finance";

export function getPurchasedUnits(transactions: Transaction[], instrumentId: string) {
  return transactions.reduce((units, transaction) => {
    if (
      transaction.status !== "paid" ||
      transaction.kind !== "expense" ||
      transaction.investment_instrument_id !== instrumentId
    ) {
      return units;
    }
    return units + (transaction.investment_units ?? 0);
  }, 0);
}

export function getPositionUnits(position: InvestmentPosition, transactions: Transaction[]) {
  return position.opening_units + getPurchasedUnits(transactions, position.instrument_id);
}

export function getPositionMarketValue(position: InvestmentPosition, transactions: Transaction[]) {
  if (!position.latest_quote) return null;
  return getPositionUnits(position, transactions) * position.latest_quote.price;
}

export function savePositionOptimistically(
  snapshot: FinanceSnapshot,
  input: { instrument: InvestmentInstrumentCandidate; opening_units: number },
  optimisticId: string,
) {
  const existing = snapshot.investment_positions.find(
    (position) => position.instrument_id === input.instrument.id,
  );
  if (existing) {
    return {
      ...snapshot,
      investment_positions: snapshot.investment_positions.map((position) =>
        position.id === existing.id
          ? { ...position, opening_units: input.opening_units, updated_at: new Date().toISOString() }
          : position,
      ),
    };
  }
  const now = new Date().toISOString();
  const instrumentId = input.instrument.id ?? `${optimisticId}:instrument`;
  const instrument = { ...input.instrument, id: instrumentId };
  return {
    ...snapshot,
    investment_positions: [...snapshot.investment_positions, {
      id: optimisticId,
      user_id: snapshot.accounts[0]?.user_id ?? "optimistic",
      instrument_id: instrumentId,
      opening_units: input.opening_units,
      created_at: now,
      updated_at: now,
      instrument,
      latest_quote: null,
    }],
  };
}
