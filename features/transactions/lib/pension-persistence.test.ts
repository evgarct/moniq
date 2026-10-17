import { expect, it } from "vitest";
import { transactionInputSchema, transactionEntryInputSchema, transactionScheduleInputSchema } from "@/types/finance-schemas";
import { validateTransactionRelationships } from "./transaction-utils";
import type { Account, Category } from "@/types/finance";
const source="00000000-0000-4000-8000-000000000001";
const destination="00000000-0000-4000-8000-000000000002";
const category="00000000-0000-4000-8000-000000000003";
const input={title:"DPS contribution",occurred_at:"2026-10-08",status:"paid",kind:"transfer",amount:1700,destination_amount:1700,source_account_id:source,destination_account_id:destination,category_id:category,allocation_id:null};
it("preserves the pension category through create, edit and recurring persistence schemas",()=>{
 expect(transactionInputSchema.parse(input).category_id).toBe(category);
 expect(transactionEntryInputSchema.parse(input).category_id).toBe(category);
 expect(transactionScheduleInputSchema.parse({...input,recurrence:{frequency:"monthly"}}).category_id).toBe(category);
});
it("defers destination eligibility to the account-aware validator",()=>{
 const values=transactionInputSchema.parse(input);
 const accounts=[{id:source,type:"cash",currency:"CZK"},{id:destination,type:"pension",currency:"CZK"}] as Account[];
 const categories=[{id:category,type:"expense",parent_id:null}] as Category[];
 expect(()=>validateTransactionRelationships(values,{accounts,categories})).not.toThrow();
 expect(()=>validateTransactionRelationships(values,{accounts:accounts.map(a=>a.id===destination?{...a,type:"cash"}:a),categories})).toThrow();
 expect(()=>validateTransactionRelationships(values,{accounts,categories:[{...categories[0],type:"income"}]})).toThrow();
});
