import { describe, expect, it } from "vitest";
import { buildBudgetExecution } from "./budget-execution";
import { getConvertedCategoryTotal } from "./budget-analytics";
import { buildBudgetStatus } from "./budget-status";
import type { Category } from "@/types/finance";
import type { Account, Transaction } from "@/types/finance";
const cash = { id: "cash", currency: "CZK", type: "cash" } as Account;
const saving = { id: "saving", currency: "CZK", type: "saving" } as Account;
const categories = [
  { id: "travel-category", parent_id: null, purpose: null, is_contribution: true },
  { id: "holiday", parent_id: null, purpose: null, is_contribution: false },
  { id: "rent", parent_id: null, purpose: null, is_contribution: false },
];
const base = { id: "fund", kind: "transfer", status: "paid", occurred_at: "2026-09-01", created_at: "2026-09-01T00:00:00Z", amount: 3000, destination_amount: 3000, source_account_id: "cash", source_account: cash, destination_account_id: "saving", destination_account: saving, allocation_id: "travel", source_allocation_id: null, category_id: "travel-category" } as Transaction;
const spend = { ...base, id: "buy", occurred_at: "2026-10-02", kind: "expense", source_account_id: "saving", source_account: saving, destination_account_id: null, destination_account: null, allocation_id: null, source_allocation_id: "travel", amount: 4000, category_id: "holiday" } as Transaction;
const run = (history: Transaction[]) => buildBudgetExecution(history, categories);
describe("budget execution provenance", () => {
  it("counts a new categorized cash contribution in full after an earlier withdrawal into cash", () => {
    const earlier = { ...base, id: "cushion-funding", amount: 10000, destination_amount: 10000, allocation_id: "cushion" };
    const release = { ...base, id: "release", occurred_at: "2026-10-06", amount: 2000, destination_amount: 2000, category_id: null,
      source_account_id: "saving", source_account: saving, source_allocation_id: "cushion", destination_account_id: "cash", destination_account: cash, allocation_id: null };
    const purchase = { ...spend, id: "own-payment", occurred_at: "2026-10-08", amount: 1700, source_account_id: "cash", source_account: cash, source_allocation_id: null };
    const october = { ...base, id: "october-funding", occurred_at: "2026-10-08" };
    const result = run([earlier, release, purchase, october]);
    expect(result.transactions.find(tx => tx.id === october.id)?.amount).toBe(3000);
    expect(result.lots.find(lot => lot.origin_id === october.id)?.remaining).toBe(3000);
    expect(run([...result.transactions]).transactions.find(tx => tx.id === october.id)?.amount).toBe(3000);
    // A later paid expense counts in full: the contribution is never counted again as spending.
    expect(run([earlier, release, purchase, october, { ...spend, occurred_at: "2026-10-09", amount: 3200 }]).transactions.at(-1)?.amount).toBe(3200);
  });
  it("counts contribution once and every paid expense in full, and preserves the ledger", () => {
    const history = [spend, base]; const result = run(history);
    expect(result.transactions.map((tx) => [tx.id,tx.amount])).toEqual([["fund",3000],["buy",4000]]);
    expect(history[0].amount).toBe(4000); expect(history[1].kind).toBe("transfer");
  });
  it("moves lots between goals without counting a second contribution", () => {
    const move = { ...base, id: "move", occurred_at: "2026-09-02", source_account_id: "saving", source_account: saving, source_allocation_id: "travel", allocation_id: "other" };
    const result = run([base,move,{...spend,source_allocation_id:"other"}]);
    expect(result.transactions.map((tx) => tx.amount)).toEqual([3000,4000]);
    expect(result.lots).toEqual([]);
  });
  it("reverses only unused contribution, on the return date and original category", () => {
    const result = run([base,{...spend,amount:1000},{...base,id:"return",occurred_at:"2026-10-03",source_account_id:"saving",source_account:saving,source_allocation_id:"travel",allocation_id:null,destination_account_id:"cash",linked_transaction_id:"fund",amount:2500}]);
    expect(result.transactions.map((tx)=>[tx.category_id,tx.amount])).toEqual([["travel-category",3000],["holiday",1000],["travel-category",-2000]]);
    expect(getConvertedCategoryTotal({transactions:result.transactions,month:new Date("2026-10-01T12:00:00"),categoryIds:new Set(["travel-category"]),targetCurrency:"CZK",exchangeRates:[]}).amount).toBe(-2000);
    expect(buildBudgetStatus({categories:[{id:"travel-category",name:"Travel",type:"expense",parent_id:null,description:"[budget: 5000]",is_system:false} as Category],transactions:result.transactions,month:new Date("2026-10-01T12:00:00"),targetCurrency:"CZK",exchangeRates:[]}).envelopes[0].spent).toBe(-2000);
  });
  it("keeps skipped funding out, leaves unknown opening balances as normal spending", () => {
    expect(run([{...base,status:"skipped"},spend]).transactions[0].amount).toBe(4000);
    expect(run([{...base,category_id:null},spend]).transactions[0].amount).toBe(4000);
  });
  it("forecasts planned funding separately without altering confirmed lots", () => {
    const result=run([{...base,status:"planned"}, {...spend,status:"planned"}]);
    expect(result.transactions.map(tx=>tx.amount)).toEqual([3000,4000]);expect(result.lots).toEqual([]);
  });
  it("keeps source and destination currencies proportional through a goal move", () => {
    const funding={...base,destination_amount:120, destination_account:{...saving,currency:"EUR" as const}};
    const result=run([funding,{...spend,amount:150,source_account:funding.destination_account}]);
    expect(result.transactions.map(tx=>tx.amount)).toEqual([3000,150]);
  });
  it("recomputes after editing or deleting funding", () => {
    expect(run([{...base,amount:2000,destination_amount:2000},spend]).transactions.at(-1)?.amount).toBe(4000);
    expect(run([spend]).transactions[0].amount).toBe(4000);
  });
});

describe("reserve for a spending envelope is not spending", () => {
  const rentExpense = { ...spend, id: "rent-oct", occurred_at: "2026-10-04", amount: 33000, category_id: "rent", source_allocation_id: "rent-reserve" } as Transaction;
  const reserve = { ...base, id: "rent-reserve-transfer", occurred_at: "2026-10-08", amount: 33000, destination_amount: 33000, allocation_id: "rent-reserve", category_id: "rent", source_account_id: "vault" } as Transaction;
  const nextRent = { ...rentExpense, id: "rent-nov", occurred_at: "2026-11-04" } as Transaction;
  it("projects only the paid rent expense, never the reserve transfer", () => {
    const result = run([rentExpense, reserve]);
    expect(result.transactions.map((tx) => [tx.id, tx.amount])).toEqual([["rent-oct", 33000]]);
    expect(result.lots).toMatchObject([{ origin_id: "rent-reserve-transfer", remaining: 33000, pool: "goal:rent-reserve" }]);
  });
  it("counts next month's payment in its own month and draws the reserve down once", () => {
    const result = run([rentExpense, reserve, nextRent]);
    expect(result.transactions.map((tx) => [tx.id, tx.occurred_at, tx.amount])).toEqual([["rent-oct", "2026-10-04", 33000], ["rent-nov", "2026-11-04", 33000]]);
    expect(result.lots).toEqual([]);
  });
  it("under- and over-payment draw the reserve by the actual amount without going negative", () => {
    const under = run([reserve, { ...nextRent, amount: 30000 }]);
    expect(under.lots[0].remaining).toBe(3000);
    const over = run([reserve, { ...nextRent, amount: 36000 }]);
    expect(over.lots).toEqual([]);
    expect(over.transactions.map((tx) => tx.amount)).toEqual([36000]);
  });
  it("does not count a repeated move of the same reserved money as a new contribution", () => {
    const moved = { ...reserve, id: "move", occurred_at: "2026-10-09", source_allocation_id: "rent-reserve", allocation_id: "other", category_id: "travel-category" } as Transaction;
    const result = run([reserve, moved]);
    expect(result.transactions).toEqual([]);
  });
});
