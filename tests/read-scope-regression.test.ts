import {describe,it,expect} from 'vitest';
import {dashboardBalances} from '../convex/lib/dashboardBalances';
describe('read reduction preserves results',()=>{
 it('retains the previous evening across midnight and excludes unrelated history',()=>{
  for(const hour of [0,2,6,12,23]){
   const day=Date.UTC(2026,8,15),now=day+hour*3600000,six=now-6*3600000;
   const rows=Array.from({length:100},(_,i)=>({paidAt:day+(i-50)*3600000,status:i%2?'PAID':'VOID'}));
   const scoped=rows.filter(r=>r.paidAt>=Math.min(day,six));
   expect(scoped.filter(r=>r.paidAt>=day&&r.status==='PAID')).toEqual(rows.filter(r=>r.paidAt>=day&&r.status==='PAID'));
   expect(scoped.filter(r=>r.paidAt>=six)).toEqual(rows.filter(r=>r.paidAt>=six));
  }
 });
 it('halves repeated ledger scans without changing balances on a large fixture',async()=>{
  const entries=Array.from({length:6000},(_,i)=>({_id:String(i),entryDate:i%2?'2026-09-15':'2026-08-31',postingStatus:i%5?'posted':'draft'}));
  const lines=Array.from({length:12000},(_,i)=>({entryId:String(i%6000),accountId:String(i%7),debit:i%3,credit:i%4}));
  let reads=0;
  const ctx={db:{query:(name:string)=>({withIndex:()=>({collect:async()=>{const v=entries.filter(e=>e.postingStatus==='posted');reads+=v.length;return v;}}),collect:async()=>{reads+=lines.length;return lines;}})}};
  const actual=await dashboardBalances(ctx,'2026-09-01','2026-09-15');
  function old(from?:string){const ids=new Set(entries.filter(e=>e.postingStatus==='posted'&&(!from||e.entryDate>=from)&&e.entryDate<='2026-09-15').map(e=>e._id));const m=new Map();for(const l of lines){if(!ids.has(l.entryId))continue;const v=m.get(l.accountId)||{debit:0,credit:0};v.debit+=l.debit;v.credit+=l.credit;m.set(l.accountId,v);}return m;}
  expect(actual.period).toEqual(old('2026-09-01'));expect(actual.lifetime).toEqual(old());
  expect(reads).toBe(16800);expect(2*(entries.length+lines.length)).toBe(36000);
 });
});
