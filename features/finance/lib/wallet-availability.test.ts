import { expect, it } from "vitest";
import { walletAvailability } from "./wallet-availability";
it("reserves all named goals and exposes Free without rounding drift",()=>{
 const result=walletAvailability({id:"s",type:"saving",balance:47330.01},[33000,9130.01,5200].map((amount)=>({wallet_id:"s",amount})));
 expect(result).toMatchObject({total_balance:47330.01,reserved_balance:47330.01,available_to_spend:0});
 expect(walletAvailability({id:"s",type:"saving",balance:100},[{wallet_id:"s",amount:60}]).available_to_spend).toBe(40);
});
it("reports over-allocation rather than hiding a deficit",()=>expect(walletAvailability({id:"s",type:"saving",balance:10},[{wallet_id:"s",amount:20}])).toMatchObject({available_to_spend:-10,availability_status:"overallocated"}));
it("never treats debt, credit, or pension as spendable cash",()=>{
 expect(walletAvailability({id:"p",type:"pension",balance:229294.06},[])).toMatchObject({reserved_balance:229294.06,available_to_spend:0});
 expect(walletAvailability({id:"d",type:"credit_card",balance:-1000},[])).toMatchObject({reserved_balance:null,available_to_spend:0});
});
it("identifies Czech DPS independently of the editable wallet name",()=>{
 const wallet={id:"p",type:"pension",balance:229294.06,name:"Renamed account",pension_state:{product_type:"cz_dps"}};
 expect(walletAvailability(wallet,[])).toMatchObject({product_type:"cz_dps",country_code:"CZ",product_name:"Doplňkové penzijní spoření (DPS)",available_to_spend:0});
});
