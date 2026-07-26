import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { AlertTriangle, ClipboardCheck, PackageX, RefreshCw, Route, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminActionCenter() {
  const { sessionToken } = useStore(); const { language } = useLanguage(); const [, go] = useLocation();
  const ar = language === "ar"; const t = (a: string, e: string) => ar ? a : e;
  const data: any = useQuery(api.adminCenter.dailyActions, { sessionToken: sessionToken || undefined });
  const blocks = [
    { title: t("طلبات تحتاج مراجعة", "Orders to review"), icon: ClipboardCheck, color: "text-amber-700 bg-amber-50", rows: data?.pendingOrders || [], link: "/orders/pending", label: (x:any) => x.customerName || x.fullName || x.orderNumber || t("طلب جديد", "New order") },
    { title: t("مخزون يحتاج طلب", "Stock to reorder"), icon: PackageX, color: "text-rose-700 bg-rose-50", rows: data?.lowStock || [], link: "/inventory", label: (x:any) => ar ? x.nameAr : (x.nameEn || x.nameAr) },
    { title: t("توصيلات فاشلة", "Failed deliveries"), icon: Route, color: "text-red-700 bg-red-50", rows: data?.failedDeliveries || [], link: "/crm", label: (x:any) => x.customerName || x.failReason || t("توصيل يحتاج متابعة", "Delivery follow-up") },
    { title: t("تجديدات خلال 7 أيام", "Renewals in 7 days"), icon: RefreshCw, color: "text-cyan-700 bg-cyan-50", rows: data?.renewals || [], link: "/crm", label: (x:any) => x.fullName },
    { title: t("مهام متابعة مفتوحة", "Open follow-ups"), icon: Users, color: "text-violet-700 bg-violet-50", rows: data?.openFollowUps || [], link: "/crm", label: (x:any) => x.note },
  ];
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>
    <header className="rounded-2xl bg-[#0e2a4a] p-6 text-white shadow-lg"><p className="text-xs font-bold text-cyan-200">{t("إدارة اليوم", "TODAY'S OPERATIONS")}</p><h1 className="mt-1 text-2xl font-black">{t("مركز الإجراءات", "Action Center")}</h1><p className="mt-2 text-sm text-slate-200">{t("كل ما يحتاج قرارًا أو متابعة الآن، من مصدره مباشرة.", "Everything needing a decision or follow-up, straight from its source.")}</p></header>
    {!data ? <p className="py-16 text-center text-slate-500">{t("جارٍ التحميل…", "Loading…")}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{blocks.map((b) => <section key={b.title} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center gap-3 border-b p-4"><div className={`grid h-10 w-10 place-items-center rounded-xl ${b.color}`}><b.icon className="h-5 w-5"/></div><div className="flex-1"><h2 className="font-black text-slate-800">{b.title}</h2><p className="text-xs text-slate-500">{b.rows.length} {t("حالة", "items")}</p></div><button onClick={() => go(b.link)} className="text-xs font-black text-cyan-700">{t("عرض", "Open")}</button></div><div className="divide-y">{b.rows.length ? b.rows.slice(0,5).map((r:any,i:number)=><button key={r._id || i} onClick={() => go(b.link)} className="flex w-full items-center gap-2 p-3 text-start text-sm hover:bg-slate-50"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-slate-400"/><span className="truncate font-semibold text-slate-700">{b.label(r)}</span></button>) : <p className="p-5 text-center text-sm text-slate-400">{t("لا يوجد إجراء مطلوب", "Nothing needs action")}</p>}</div></section>)}</div>}
  </div>;
}
