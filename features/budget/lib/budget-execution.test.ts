import { describe, expect, it } from "vitest";
import { buildBudgetExecution } from "./budget-execution";
import { getConvertedCategoryTotal } from "./budget-analytics";
import { buildBudgetStatus } from "./budget-status";
import type { Category } from "@/types/finance";
import type { Account, Transaction } from "@/types/finance";
const cash = { id: "cash", currency: "CZK", type: "cash" } as Account;
const saving = { id: "saving", currency: "CZK", type: "saving" } as Account;
const base = { id: "fund", kind: "transfer", status: "paid", occurred_at: "2026-09-01", created_at: "2026-09-01T00:00:00Z", amount: 3000, destination_amount: 3000, source_account_id: "cash", source_account: cash, destination_account_id: "saving", destination_account: saving, allocation_id: "travel", source_allocation_id: null, category_id: "travel-category" } as Transaction;
const spend = { ...base, id: "buy", occurred_at: "2026-10-02", kind: "expense", source_account_id: "saving", source_account: saving, destination_account_id: null, destination_account: null, allocation_id: null, source_allocation_id: "travel", amount: 4000, category_id: "holiday" } as Transaction;
describe("budget execution provenance", () => {
  it("counts a new categorized cash contribution in full after an earlier withdrawal into cash", () => {
    const earlier = { ...base, id: "cushion-funding", amount: 10000, destination_amount: 10000, allocation_id: "cushion" };
    const release = { ...base, id: "release", occurred_at: "2026-10-06", amount: 2000, destination_amount: 2000, category_id: null,
      source_account_id: "saving", source_account: saving, source_allocation_id: "cushion", destination_account_id: "cash", destination_account: cash, allocation_id: null };
    const purchase = { ...spend, id: "own-payment", occurred_at: "2026-10-08", amount: 1700, source_account_id: "cash", source_account: cash, source_allocation_id: null };
    const october = { ...base, id: "october-funding", occurred_at: "2026-10-08" };
    const result = buildBudgetExecution([earlier, release, purchase, october]);
    expect(result.transactions.find(tx => tx.id === october.id)?.amount).toBe(3000);
    expect(result.lots.find(lot => lot.origin_id === october.id)?.remaining).toBe(3000);
    expect(buildBudgetExecution([...result.transactions]).transactions.find(tx => tx.id === october.id)?.amount).toBe(3000);
    expect(buildBudgetExecution([earlier, release, purchase, october, { ...spend, occurred_at: "2026-10-09", amount: 3200 }]).transactions.at(-1)?.amount).toBe(200);
  });
  it("counts funding once, excludes only covered spending, and preserves the ledger", () => {
    const history = [spend, base]; const result = buildBudgetExecution(history);
    expect(result.transactions.map((tx) => [tx.id,tx.amount])).toEqual([["fund",3000],["buy",1000]]);
    expect(history[0].amount).toBe(4000); expect(history[1].kind).toBe("transfer");
  });
  it("moves lots between goals without counting a second contribution", () => {
    const move = { ...base, id: "move", occurred_at: "2026-09-02", source_account_id: "saving", source_account: saving, source_allocation_id: "travel", allocation_id: "other" };
    const result = buildBudgetExecution([base,move,{...spend,source_allocation_id:"other"}]);
    expect(result.transactions.map((tx) => tx.amount)).toEqual([3000,1000]);
    expect(result.lots).toEqual([]);
  });
  it("reverses only unused funding, on the return date and original category", () => {
    const result = buildBudgetExecution([base,{...spend,amount:1000},{...base,id:"return",occurred_at:"2026-10-03",source_account_id:"saving",source_account:saving,source_allocation_id:"travel",allocation_id:null,destination_account_id:"cash",linked_transaction_id:"fund",amount:2500}]);
    expect(result.transactions.map((tx)=>[tx.category_id,tx.amount])).toEqual([["travel-category",3000],["travel-category",-2000]]);
    expect(getConvertedCategoryTotal({transactions:result.transactions,month:new Date("2026-10-01T12:00:00"),categoryIds:new Set(["travel-category"]),targetCurrency:"CZK",exchangeRates:[]}).amount).toBe(-2000);
    expect(buildBudgetStatus({categories:[{id:"travel-category",name:"Travel",type:"expense",parent_id:null,description:"[budget: 5000]",is_system:false} as Category],transactions:result.transactions,month:new Date("2026-10-01T12:00:00"),targetCurrency:"CZK",exchangeRates:[]}).envelopes[0].spent).toBe(-2000);
  });
  it("keeps skipped funding out, leaves unknown opening balances as normal spending", () => {
    expect(buildBudgetExecution([{...base,status:"skipped"},spend]).transactions[0].amount).toBe(4000);
    expect(buildBudgetExecution([{...base,category_id:null},spend]).transactions[0].amount).toBe(4000);
  });
  it("forecasts planned funding separately without altering confirmed lots", () => {
    const result=buildBudgetExecution([{...base,status:"planned"}, {...spend,status:"planned"}]);
    expect(result.transactions.map(tx=>tx.amount)).toEqual([3000,1000]);expect(result.lots).toEqual([]);
  });
  it("keeps source and destination currencies proportional through a goal move", () => {
    const funding={...base,destination_amount:120, destination_account:{...saving,currency:"EUR" as const}};
    const result=buildBudgetExecution([funding,{...spend,amount:150,source_account:funding.destination_account}]);
    expect(result.transactions.map(tx=>tx.amount)).toEqual([3000,30]);
  });
  it("recomputes after editing or deleting funding", () => {
    expect(buildBudgetExecution([{...base,amount:2000,destination_amount:2000},spend]).transactions.at(-1)?.amount).toBe(2000);
    expect(buildBudgetExecution([spend]).transactions[0].amount).toBe(4000);
  });
});
