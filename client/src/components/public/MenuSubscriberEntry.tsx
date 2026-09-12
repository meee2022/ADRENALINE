import { Phone, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Presentation only: identity lookup, selection and persistence remain in PublicMenu. */
export function MenuSubscriberEntry({ isRtl, phone, verifiedPhone, error, customers, onPhoneChange, onVerify, onPick, onReset }: {
  isRtl: boolean; phone: string; verifiedPhone: string; error: string;
  customers: { _id: string; fullName?: string }[] | undefined;
  onPhoneChange: (value: string) => void; onVerify: () => void;
  onPick: (customer: { _id: string; fullName?: string }) => void; onReset: () => void;
}) {
  const loading = !!verifiedPhone && customers === undefined;
  return <section className="menu-subscriber-entry" aria-labelledby="subscriber-entry-title" dir={isRtl ? 'rtl' : 'ltr'}>
    <div>
      <h2 id="subscriber-entry-title"><Phone size={18} aria-hidden="true" />{isRtl ? 'وجبات اشتراكك' : 'Your subscription meals'}</h2>
      <p>{isRtl ? 'مشترك بالفعل؟ أدخل رقمك لاختيار وجباتك يدويًا أو بالخطة الذكية.' : 'Already subscribed? Enter your number to choose meals manually or with a smart plan.'}</p>
    </div>
    {!verifiedPhone ? <form onSubmit={event => { event.preventDefault(); onVerify(); }}>
      <label htmlFor="menu-subscriber-phone" className="sr-only">{isRtl ? 'رقم جوال المشترك' : 'Subscriber mobile number'}</label>
      <div className="menu-phone-row">
        <Input id="menu-subscriber-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone}
          placeholder={isRtl ? 'رقم الجوال' : 'Mobile number'} onChange={event => onPhoneChange(event.target.value)}
          aria-invalid={!!error} aria-describedby={error ? 'menu-phone-error' : undefined} />
        <Button type="submit">{isRtl ? 'متابعة' : 'Continue'}<ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} aria-hidden="true" /></Button>
      </div>
      {error && <p id="menu-phone-error" role="alert" className="menu-entry-error">{error}</p>}
    </form> : <div className="menu-entry-result" aria-live="polite">
      {loading ? <p role="status">{isRtl ? 'جارٍ البحث عن اشتراكك…' : 'Finding your subscription…'}</p> : customers?.length ? <>
        <p>{isRtl ? 'اختر اسم المشترك للمتابعة' : 'Choose the subscriber to continue'}</p>
        <div className="menu-recipient-list">{customers.map(customer => <Button key={customer._id} variant="outline" onClick={() => onPick(customer)}><User size={16} aria-hidden="true" />{customer.fullName}</Button>)}</div>
      </> : <p role="alert">{isRtl ? 'لم نجد اشتراكًا بهذا الرقم. تأكد من الرقم أو تواصل مع الأخصائية.' : 'No subscription found. Check your number or contact the nutritionist.'}</p>}
      <Button variant="ghost" onClick={onReset}>{isRtl ? 'تغيير الرقم' : 'Change number'}</Button>
    </div>}
  </section>;
}
