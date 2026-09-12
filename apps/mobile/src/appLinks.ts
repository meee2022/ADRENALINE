/** Allowlisted destinations only; incoming links never carry authentication. */
export function appDestination(value:string):string|null {
  try{
    const url=new URL(value.startsWith('/')&&!value.startsWith('//')?'https://adrenalinehealthy.com'+value:value);
    if(!['https:','adrenaline:'].includes(url.protocol))return null;
    if(url.protocol==='https:'&&url.hostname!=='adrenalinehealthy.com'&&url.hostname!=='www.adrenalinehealthy.com')return null;
    const path=url.protocol==='adrenaline:'?'/'+url.hostname+url.pathname:url.pathname;
    if(['/public/plans','/plans'].includes(path))return '/plans';
    if(['/public/order-tracking','/order-tracking'].includes(path))return '/order-tracking';
    if(['/public/menu','/menu','/customer/smart-plan','/smart-plan'].includes(path))return '/menu';
    if(['/','/today','/customer/today'].includes(path))return '/';
    const tracking=path.match(/^\/track\/([a-zA-Z0-9_-]{1,256})$/);
    if(tracking)return '/track/'+tracking[1];
    const meal=path.match(/^\/(?:public\/)?meal\/([a-zA-Z0-9_-]+)$/);
    return meal?'/meal/'+meal[1]:null;
  }catch{return null;}
}
