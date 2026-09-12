import { mutation,internalQuery,internalMutation,internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v,ConvexError } from 'convex/values';
import { requireStaffOrSubscriptionOwner } from './sessions';
export const register=mutation({
  args:{customerId:v.id('customers'),sessionToken:v.string(),token:v.string()},
  handler:async(ctx,a)=>{
    await requireStaffOrSubscriptionOwner(ctx,a.sessionToken,a.customerId);
    if(!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(a.token))throw new ConvexError('Invalid device token');
    const old=await ctx.db.query('mobilePushDevices').withIndex('by_token',q=>q.eq('token',a.token)).unique();
    if(old)await ctx.db.delete(old._id);
    await ctx.db.insert('mobilePushDevices',{customerId:a.customerId,token:a.token,createdAt:Date.now(),cursor:Date.now()});
  }
});
export const unregister=mutation({
  args:{customerId:v.id('customers'),sessionToken:v.string()},
  handler:async(ctx,a)=>{
    await requireStaffOrSubscriptionOwner(ctx,a.sessionToken,a.customerId);
    // Explicit logout revokes this subscriber's push registrations.
    for(const d of await ctx.db.query('mobilePushDevices').collect())if(d.customerId===a.customerId)await ctx.db.delete(d._id);
  }
});
export const batches=internalQuery({args:{},handler:async(ctx)=>{
  const devices=await ctx.db.query('mobilePushDevices').collect();
  return Promise.all(devices.map(async d=>{
    const rows=await ctx.db.query('notifications').withIndex('by_targetCustomer',q=>q.eq('targetCustomerId',d.customerId)).collect();
    return {id:d._id,token:d.token,events:rows.filter(n=>n.createdAt>d.cursor).sort((a,b)=>a.createdAt-b.createdAt).slice(0,20).map(n=>({at:n.createdAt,type:n.type}))};
  }));
}});
export const advance=internalMutation({args:{id:v.id('mobilePushDevices'),cursor:v.number(),remove:v.optional(v.boolean())},handler:async(ctx,a)=>{
  const d=await ctx.db.get(a.id);if(!d)return;
  if(a.remove)await ctx.db.delete(a.id);else await ctx.db.patch(a.id,{cursor:Math.max(d.cursor,a.cursor)});
}});
/** Opt-in deployment gate. No push is sent unless explicitly configured. */
export const dispatch=internalAction({args:{},handler:async(ctx)=>{
  if(process.env.MOBILE_PUSH_ENABLED!=='true')return;
  const batches=await ctx.runQuery(internal.mobilePush.batches,{});
  for(const b of batches){
    if(!b.events.length)continue;
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:'Bearer '+process.env.EXPO_ACCESS_TOKEN}:{})},
      body:JSON.stringify({to:b.token,title:'أدرينالين',body:'يوجد تحديث على طلبك. افتح التطبيق للاطلاع عليه.',data:{url:'https://adrenalinehealthy.com/today'},channelId:'orders'})});
    if(!response.ok)continue;
    const result=await response.json();
    if(result.data?.status==='ok')await ctx.runMutation(internal.mobilePush.advance,{id:b.id,cursor:b.events[b.events.length-1].at});
    else if(result.data?.details?.error==='DeviceNotRegistered')await ctx.runMutation(internal.mobilePush.advance,{id:b.id,cursor:0,remove:true});
  }
}});
