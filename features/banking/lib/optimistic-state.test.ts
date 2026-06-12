import { describe, expect, it } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import {
  confirmImportedTransactions,
  deleteImportBatch,
  updateImportedTransaction,
} from "@/features/banking/lib/optimistic-state";
import type { Account, Category } from "@/types/finance";
import type { TransactionImport, TransactionImportSnapshot } from "@/types/imports";

const wallet = {
  id: "wallet",
  user_id: "user",
  name: "Everyday",
  type: "cash",
  currency: "CZK",
  balance: 1000,
} as Account;
const category = {
  id: "category",
  user_id: "user",
  name: "Groceries",
  type: "expense",
} as Category;
const imported = {
  id: "import",
  user_id: "user",
  batch_id: "batch",
  wallet_id: wallet.id,
  finance_transaction_id: null,
  external_id: null,
  row_index: 1,
  fingerprint: "fingerprint",
  amount: -125,
  currency: "CZK",
  occurred_at: "2026-06-12",
  kind: "expense",
  counterpart_wallet_id: null,
  merchant_raw: "Market",
  merchant_clean: "Market",
  category_id: category.id,
  category,
  status: "draft",
  batch: null,
  wallet,
  counterpart_wallet: null,
  finance_transaction: null,
  created_at: "2026-06-12T08:00:00.000Z",
  updated_at: "2026-06-12T08:00:00.000Z",
} satisfies TransactionImport;

function makeBankingSnapshot(): TransactionImportSnapshot {
  return {
    batches: [{ id: "batch" } as never],
    rules: [],
    wallets: [wallet],
    categories: [category],
    draftTransactions: [imported],
    confirmedTransactions: [],
  };
}

describe("optimistic banking state", () => {
  it("updates imported transaction relationships immediately", () => {
    const next = updateImportedTransaction(makeBankingSnapshot(), imported.id, {
      merchant_clean: "Updated market",
      category_id: null,
    });

    expect(next.draftTransactions[0]).toMatchObject({
      merchant_clean: "Updated market",
      category_id: null,
      category: null,
      status: "draft",
    });
  });

  it("removes a batch and all of its transactions", () => {
    const next = deleteImportBatch(makeBankingSnapshot(), "batch");

    expect(next.batches).toHaveLength(0);
    expect(next.draftTransactions).toHaveLength(0);
  });

  it("moves confirmed imports and creates an optimistic finance transaction", () => {
    const finance = {
      ...createEmptyFinanceSnapshot(),
      accounts: [wallet],
      categories: [category],
    };
    const next = confirmImportedTransactions(
      makeBankingSnapshot(),
      finance,
      [imported.id],
    );

    expect(next.banking.draftTransactions).toHaveLength(0);
    expect(next.banking.confirmedTransactions[0]).toMatchObject({
      id: imported.id,
      status: "confirmed",
      finance_transaction_id: `optimistic:import:${imported.id}`,
    });
    expect(next.finance.transactions[0]).toMatchObject({
      id: `optimistic:import:${imported.id}`,
      title: category.name,
      amount: 125,
      source_account_id: wallet.id,
    });
    expect(next.finance.accounts[0]?.balance).toBe(875);
  });
});
