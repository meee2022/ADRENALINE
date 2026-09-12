import { query } from './_generated/server';
import { v } from 'convex/values';
import { requireStaffOrSubscriptionOwner } from './sessions';
/** Owner-scoped status only. Never infer approval from a local draft. */
export const overview=query({
  args:{customerId:v.id('customers'),sessionToken:v.string()},
  handler:async(ctx,args)=>{
    await requireStaffOrSubscriptionOwner(ctx,args.sessionToken,args.customerId);
    const customer=await ctx.db.get(args.customerId);
    if(!customer)return null;
    const orders=await ctx.db.query('customerOrders').withIndex('by_phone',q=>q.eq('customerPhone',customer.phone)).order('desc').take(100);
    // Orders may be submitted before the subscription starts. Creation time is
    // not proof that an order belongs to a previous subscription period.
    const linked=orders.filter(o=>o.customerId===customer._id&&o.status!=='cancelled');
    const pending=linked.some(o=>o.status==='pending');
    const plans=await ctx.db.query('dailyPlans').withIndex('by_customerId',q=>q.eq('customerId',customer._id)).collect();
    const today=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
    const active=customer.isActive&&!customer.pausedFrom&&(!customer.endDate||customer.endDate>=today);
    const activePlans=plans.filter(p=>p.date>=today&&p.date>=(customer.startDate||today)&&p.date<=(customer.endDate||today)&&p.status!=='CANCELLED');
    return {pending,hasApprovedPlan:activePlans.some(p=>p.status!=='DRAFT'),active,
      // Conservative: no new selection CTA while any submitted plan needs reconciliation.
      canStartSelection:!pending&&!linked.some(o=>['confirmed','active'].includes(o.status))&&!activePlans.length&&active,
      updatedAt:Date.now()};
  }
});
