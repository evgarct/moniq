import { expect, it } from "vitest";
import { buildInvestmentSummary } from "./investment-summary";
import type { Account, ExchangeRate, InvestmentPosition } from "@/types/finance";
const pension={id:"p",type:"pension",name:"DPS",balance:229294.06,currency:"CZK"} as Account;
const position={id:"i",opening_units:10,instrument_id:"etf",instrument:{name:"ETF",quote_currency:"EUR"},latest_quote:{price:100,currency:"EUR",market_date:"2026-10-16"}} as InvestmentPosition;
const rate={provider:"frankfurter",base_currency:"EUR",quote_currency:"CZK",requested_date:"2026-10-17",rate_date:"2026-10-16",rate:25,fetched_at:"2026-10-17"} as ExchangeRate;
it("combines market investments and locked pension exactly once in the default currency",()=>{
 expect(buildInvestmentSummary({accounts:[pension],positions:[position],transactions:[],currency:"CZK",exchangeRates:[rate],asOf:"2026-10-17"})).toMatchObject({total_value:254294.06,market_value:25000,pension_value:229294.06,available:true});
});
it("does not publish a partial total when FX or a quote is missing",()=>{
 expect(buildInvestmentSummary({accounts:[pension],positions:[position],transactions:[],currency:"CZK",exchangeRates:[],asOf:"2026-10-17"})).toMatchObject({total_value:null,pension_value:229294.06,market_value:null,available:false});
});
it("converts pension to a different chosen default currency",()=>{
 const result=buildInvestmentSummary({accounts:[pension],positions:[],transactions:[],currency:"EUR",exchangeRates:[rate],asOf:"2026-10-17"});
 expect(result.total_value).toBe(9171.76);expect(result.items[0].locked).toBe(true);
});
