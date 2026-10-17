import { convertMoney } from "@/features/finance/lib/exchange-rates";
import { getPositionMarketValue } from "./positions";
import type { Account, ExchangeRate, InvestmentPosition, Transaction } from "@/types/finance";
import type { CurrencyCode } from "@/types/currency";

export function buildInvestmentSummary(options: { accounts: Account[]; positions: InvestmentPosition[]; transactions: Transaction[]; currency: CurrencyCode; exchangeRates: ExchangeRate[]; asOf?: string }) {
  const asOf = options.asOf ?? new Date().toISOString().slice(0,10);
  const native = [
    ...options.positions.map(position => ({ id:position.id, name:position.instrument.name, kind:"market" as const, value:getPositionMarketValue(position,options.transactions), currency:position.latest_quote?.currency ?? position.instrument.quote_currency, as_of:position.latest_quote?.market_date ?? null })),
    ...options.accounts.filter(account=>account.type==="pension").map(account=>({id:account.id,name:account.name,kind:"pension" as const,value:account.balance,currency:account.currency,as_of:account.pension_state?.statements.map(s=>s.as_of).sort().at(-1) ?? null})),
  ];
  const items=native.map(item=>{
    const converted=item.value===null?null:convertMoney({amount:item.value,sourceCurrency:item.currency,targetCurrency:options.currency,requestedDate:asOf,exchangeRates:options.exchangeRates});
    return {...item,converted_value:converted && converted.status!=="missing_rate"?Number(converted.amount.toFixed(2)):null,locked:item.kind==="pension"};
  });
  const sum=(group:typeof items)=>group.some(item=>item.converted_value===null)?null:Number(group.reduce((total,item)=>total+(item.converted_value??0),0).toFixed(2));
  return {currency:options.currency,as_of:asOf,total_value:sum(items),market_value:sum(items.filter(item=>item.kind==="market")),pension_value:sum(items.filter(item=>item.kind==="pension")),available:items.every(item=>item.converted_value!==null),items};
}
