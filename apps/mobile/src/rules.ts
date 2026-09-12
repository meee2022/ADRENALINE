/** القواعد المشتركة — المصدر الوحيد نفسه للويب والخادم. لا قاعدة تُكتب في التطبيق. */
export * from "../../../shared/rules";
import {slotToDate as sharedSlotToDate} from '../../../shared/rules';
/** Align displayed/requested delivery dates with the server's Qatar cutoff. */
export function slotToDate(start:string|null|undefined,rotation:number,week:number,day:string,today=new Date(Date.now()+3*60*60*1000).toISOString().slice(0,10)){
  return sharedSlotToDate(start,rotation,week,day,today);
}
