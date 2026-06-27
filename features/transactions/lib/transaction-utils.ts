import type { TransactionInput } from "@/types/finance-schemas";
import type { Account, Category, InvestmentPosition, Transaction } from "@/types/finance";
import { isInvestmentCategory } from "@/features/categories/lib/category-tree";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";

export function getTransactionAnalyticsAmount(transaction: Transaction) {
  if (!isSettledTransactionStatus(transaction.status)) {
    return 0;
  }

  if (transaction.kind === "income" || transaction.kind === "expense") {
    return Math.abs(transaction.amount);
  }

  if (transaction.kind === "debt_payment") {
    return Math.abs(transaction.interest_amount ?? 0);
  }

  return 0;
}

export function getTransactionPrimaryAccount(transaction: Transaction) {
  return transaction.source_account ?? transaction.destination_account;
}

export function getTransactionDisplayCategory(transaction: Transaction) {
  if (transaction.category) {
    return transaction.category.name;
  }

  if (transaction.kind === "transfer") {
    return "Transfer";
  }

  if (transaction.kind === "debt_payment") {
    return "Debt payment";
  }

  return "Uncategorized";
}

export function validateTransactionRelationships(
  values: TransactionInput,
  options: {
    accounts: Account[];
    categories: Category[];
    investment_positions?: InvestmentPosition[];
  },
) {
  const sourceAccount = values.source_account_id
    ? options.accounts.find((account) => account.id === values.source_account_id) ?? null
    : null;
  const destinationAccount = values.destination_account_id
    ? options.accounts.find((account) => account.id === values.destination_account_id) ?? null
    : null;
  const category = values.category_id
    ? options.categories.find((item) => item.id === values.category_id) ?? null
    : null;

  if (values.source_account_id && !sourceAccount) {
    throw new Error("Source account not found.");
  }

  if (values.destination_account_id && !destinationAccount) {
    throw new Error("Destination account not found.");
  }

  if (values.category_id && !category) {
    throw new Error("Category not found.");
  }

  if ((values.kind === "income" || values.kind === "expense") && category?.type !== values.kind) {
    throw new Error("Choose a category with the matching type.");
  }

  if (values.kind === "debt_payment" && category && category.type !== "expense") {
    throw new Error("Debt payment interest can only use an expense category.");
  }

  if (
    values.kind === "debt_payment" &&
    destinationAccount?.type !== "debt" &&
    destinationAccount?.type !== "credit_card"
  ) {
    throw new Error("Debt payment must target a debt or credit card account.");
  }

  if (values.kind === "transfer" && values.category_id) {
    throw new Error("Transfers do not use categories.");
  }

  const hasInstrument = Boolean(values.investment_instrument_id);
  const hasUnits = values.investment_units != null;
  if (hasInstrument !== hasUnits || (values.investment_units != null && values.investment_units <= 0)) {
    throw new Error("Choose an investment and provide positive purchased units.");
  }
  if (hasInstrument && values.kind !== "expense") {
    throw new Error("Investment purchases must be expenses.");
  }
  if (
    values.investment_instrument_id &&
    !options.investment_positions?.some((position) => position.instrument_id === values.investment_instrument_id)
  ) {
    throw new Error("Investment position not found.");
  }
  if (values.investment_instrument_id && !isInvestmentCategory(options.categories, values.category_id)) {
    throw new Error("Investment purchases must use the investment category.");
  }
  if (
    values.investment_instrument_id &&
    !options.investment_positions?.some(
      (position) =>
        position.instrument_id === values.investment_instrument_id && position.instrument.type === "etf",
    )
  ) {
    throw new Error("Investment purchases must use an ETF position.");
  }
}

export function getTransactionSignedAmount(transaction: Transaction) {
  if (!isSettledTransactionStatus(transaction.status)) {
    return 0;
  }

  if (transaction.kind === "income") {
    return Math.abs(transaction.amount);
  }

  if (transaction.kind === "transfer") {
    return 0;
  }

  return -Math.abs(transaction.amount);
}
