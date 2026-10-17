import { expect, it } from "vitest";
import { applyPensionStatement, pensionBalance, pensionStatementSchema } from "./pension";
import type { Account, Transaction } from "@/types/finance";
const statement={as_of:"2026-10-17",total_value:229294.06,invested:190781.8,provider_result:29572.72,entries:[]};
it("does not add contributions already included in the valuation",()=>{
 expect(pensionBalance(statement,[{id:"e",source:"employer",amount:4161,occurred_at:"2026-10-08"}], [{destination_account_id:"p",status:"paid",amount:1700,occurred_at:"2026-10-08"} as Transaction],"p")).toBe(229294.06);
});
it("adds only confirmed later contributions, never projected ones or internal purchases",()=>{
 expect(pensionBalance(statement,[{id:"e",source:"state",amount:340,occurred_at:"2026-10-18"},{id:"i",source:"internal_investment",amount:5861,occurred_at:"2026-10-18"}],[{destination_account_id:"p",status:"planned",amount:1700,occurred_at:"2026-11-08"} as Transaction],"p")).toBe(229634.06);
});
it("retries safely, accepts falling valuations, and keeps provider figures independent",()=>{
 const account={id:"p",balance:0} as Account;
 const first=applyPensionStatement(account,statement,[]);
 expect(applyPensionStatement(first,statement,[])).toEqual(first);
 expect(first.pension_state?.statements[0].provider_result).toBe(29572.72);
 expect(applyPensionStatement(first,{...statement,total_value:200000},[]).balance).toBe(200000);
});
it("rejects duplicate IDs and own contributions without a ledger reference",()=>{
 expect(pensionStatementSchema.safeParse({...statement,entries:[{id:"x",source:"own",amount:1700,occurred_at:"2026-10-08"}]}).success).toBe(false);
});
