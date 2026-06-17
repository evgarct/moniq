export type DebtPaymentBreakdownInput = {
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  extra_principal_amount: number | null;
};

export type DebtPaymentBreakdown = {
  principal_amount: number;
  interest_amount: number;
  extra_principal_amount: number;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function isFilled(value: number | null | undefined) {
  return value != null;
}

export function normalizeDebtPaymentBreakdown(
  input: DebtPaymentBreakdownInput,
): DebtPaymentBreakdown | null {
  const amount = roundMoney(input.amount);
  const provided = {
    principal_amount: input.principal_amount,
    interest_amount: input.interest_amount,
    extra_principal_amount: input.extra_principal_amount,
  };
  const filledKeys = Object.entries(provided)
    .filter(([, value]) => isFilled(value))
    .map(([key]) => key as keyof typeof provided);

  if (amount <= 0) {
    return {
      principal_amount: input.principal_amount ?? 0,
      interest_amount: input.interest_amount ?? 0,
      extra_principal_amount: input.extra_principal_amount ?? 0,
    };
  }

  if (filledKeys.length === 0) {
    return {
      principal_amount: amount,
      interest_amount: 0,
      extra_principal_amount: 0,
    };
  }

  const principal = input.principal_amount ?? 0;
  const interest = input.interest_amount ?? 0;
  const extra = input.extra_principal_amount ?? 0;
  const knownTotal = roundMoney(principal + interest + extra);
  const missing = roundMoney(amount - knownTotal);

  if (missing < -0.01) return null;

  if (filledKeys.length === 3) {
    return Math.abs(knownTotal - amount) <= 0.01
      ? {
          principal_amount: principal,
          interest_amount: interest,
          extra_principal_amount: extra,
        }
      : null;
  }

  if (!isFilled(input.principal_amount)) {
    return {
      principal_amount: missing,
      interest_amount: interest,
      extra_principal_amount: extra,
    };
  }

  if (!isFilled(input.extra_principal_amount)) {
    return {
      principal_amount: principal,
      interest_amount: interest,
      extra_principal_amount: missing,
    };
  }

  return {
    principal_amount: principal,
    interest_amount: missing,
    extra_principal_amount: extra,
  };
}
