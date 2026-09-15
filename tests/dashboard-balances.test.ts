import { describe, it, expect } from "vitest";
import { dashboardBalances } from "../convex/lib/dashboardBalances";
import { errorDiagnostic } from "../client/src/lib/errorDiagnostic";
describe("dashboard ledger read regression", () => {
  it("reads once and preserves period, opening balances, and posted-only semantics", async () => {
    const reads: string[] = [];
    const entries = [{_id:"old",entryDate:"2026-08-31"},{_id:"now",entryDate:"2026-09-01"},{_id:"end",entryDate:"2026-09-15"},{_id:"future",entryDate:"2026-09-16"}];
    const lines = [{entryId:"old",accountId:"cash",debit:100},{entryId:"now",accountId:"cash",credit:20},{entryId:"end",accountId:"cash",debit:5},{entryId:"future",accountId:"cash",debit:900},{entryId:"draft",accountId:"cash",debit:900}];
    const ctx = {db:{query:(table:string)=>({withIndex:(name:string,fn:any)=>{expect(name).toBe("by_status");fn({eq:(field:string,value:string)=>{expect([field,value]).toEqual(["postingStatus","posted"]);}});return {collect:async()=>{reads.push(table);return entries;}};},collect:async()=>{reads.push(table);return lines;}})}};
    const result=await dashboardBalances(ctx,"2026-09-01","2026-09-15");
    expect(reads).toEqual(["finJournalEntries","finJournalLines"]);
    expect(result.period.get("cash")).toEqual({debit:5,credit:20});
    expect(result.lifetime.get("cash")).toEqual({debit:105,credit:20});
  });
  it("extracts operation and request without exposing arbitrary error text",()=>{
    expect(errorDiagnostic(new Error('[CONVEX Q(financeReports:financeDashboard)] [Request ID: 9b16feeafed95839] Server Error secret'))).toEqual({operation:'financeReports:financeDashboard',requestId:'9b16feeafed95839'});
    expect(errorDiagnostic(new Error('private token=secret'))).toEqual({operation:undefined,requestId:undefined});
  });
});
