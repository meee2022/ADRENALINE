/**
 * @file client/src/pages/Suppliers.tsx
 * @description إدارة الموردين — قائمة + إحصائيات مشتريات كل مورّد + إضافة/تعديل (هوية أدرينالين)
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Phone, Package, Truck, ArrowRight, Coins, CalendarClock, Pencil } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";

const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

export default function SuppliersPage() {
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const suppliers: any[] = useQuery(api.inventory.getSuppliers, sessionToken ? { sessionToken } : "skip") || [];
  const stats: any[] = useQuery(api.inventory.getSupplierStats, sessionToken ? { sessionToken } : "skip") || [];
  const createSupplier = useMutation(api.inventory.createSupplier);
  const updateSupplier = useMutation(api.inventory.updateSupplier);

  const statsMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of stats) m.set(s.supplierId, s);
    return m;
  }, [stats]);
  const totalPurchaseValue = useMemo(() => stats.reduce((sum, s) => sum + Number(s.totalValue || 0), 0), [stats]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const emptyForm = { name: "", phone: "", contactName: "", email: "", address: "", taxNumber: "", paymentTerms: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ ...emptyForm, ...s }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: isRtl ? "خطأ" : "Error", description: isRtl ? "الاسم مطلوب" : "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim() || undefined, contactName: form.contactName.trim() || undefined, email: form.email.trim() || undefined, address: form.address.trim() || undefined, taxNumber: form.taxNumber.trim() || undefined, paymentTerms: form.paymentTerms.trim() || undefined, notes: form.notes.trim() || undefined, sessionToken };
      if (editing) { await updateSupplier({ id: editing._id, ...payload }); toast({ title: isRtl ? "تم التعديل" : "Updated" }); }
      else { await createSupplier(payload); toast({ title: isRtl ? "تمت الإضافة" : "Added" }); }
      setShowModal(false); setForm(emptyForm); setEditing(null);
    } catch (error: any) {
      toast({ title: isRtl ? "خطأ" : "Error", description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Users className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="إدارة الموردين" titleEn="Suppliers"
          subtitleAr="الموردون ومشترياتهم" subtitleEn="Suppliers & their purchases"
          kpis={[
            { value: suppliers.length, labelAr: "إجمالي الموردين", labelEn: "Total Suppliers" },
            { value: fmt(totalPurchaseValue), labelAr: "إجمالي المشتريات", labelEn: "Total Purchases" },
          ]}
          actions={
            <>
              <button onClick={() => setLocation("/inventory/receive")} className="hidden sm:flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2"><Truck className="h-4 w-4" /> {isRtl ? "استلام بضاعة" : "Receive"}</button>
              <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2"><ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}</button>
            </>
          }
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <div className="flex justify-end">
          <Button onClick={openAdd} className="h-11 rounded-xl text-white shadow-lg font-bold" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}><Plus className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />{isRtl ? "إضافة مورّد" : "Add Supplier"}</Button>
        </div>

        {suppliers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">{isRtl ? "لا يوجد موردون" : "No suppliers"}</p>
            <Button onClick={openAdd} variant="outline" className="mt-4">{isRtl ? "إضافة أول مورّد" : "Add First Supplier"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => {
              const st = statsMap.get(s._id);
              return (
                <div key={s._id} className="bg-white rounded-2xl p-4 hover:-translate-y-0.5 transition-all" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">{(s.name || "?").charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">{s.name}</h3>
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-600" dir="ltr"><Phone className="h-4 w-4" /><span>{s.phone}</span></a>
                      ) : (<span className="text-sm text-slate-400">{isRtl ? "بدون رقم" : "No phone"}</span>)}
                    </div>
                    <button onClick={() => openEdit(s)} title={isRtl ? "تعديل" : "Edit"} className="h-9 w-9 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 shrink-0"><Pencil className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                    <Stat icon={Truck} label={isRtl ? "فواتير" : "Receipts"} value={st ? String(st.purchases) : "0"} />
                    <Stat icon={Coins} label={isRtl ? "قيمة الشراء" : "Purchased"} value={st ? `${fmt(st.totalValue)}` : "0"} suffix={isRtl ? "ر.ق" : "QAR"} />
                    <Stat icon={Package} label={isRtl ? "أصناف" : "Items"} value={st ? String(st.itemCount) : "0"} />
                  </div>
                  {st?.lastPurchase && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400"><CalendarClock className="h-3.5 w-3.5" />{isRtl ? "آخر شراء:" : "Last purchase:"} <span className="text-slate-600" dir="ltr">{st.lastPurchase}</span></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-[560px]", isRtl && "rtl")}>
          <DialogHeader><DialogTitle>{editing ? (isRtl ? "تعديل المورّد" : "Edit Supplier") : (isRtl ? "إضافة مورّد جديد" : "Add New Supplier")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم المورّد" : "Supplier Name"} <span className="text-red-500">*</span></Label>
              <Input required placeholder={isRtl ? "مثال: مزارع اليوم" : "e.g. Fresh Farms"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={isRtl ? "text-right" : ""} />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "رقم الهاتف (اختياري)" : "Phone (optional)"}</Label>
              <Input type="tel" placeholder="+974 XXXX XXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>{isRtl ? "اسم المسؤول" : "Contact"}</Label><Input value={form.contactName} onChange={(e)=>setForm({...form,contactName:e.target.value})}/></div><div className="space-y-2"><Label>{isRtl ? "البريد" : "Email"}</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></div></div>
            <div className="space-y-2"><Label>{isRtl ? "العنوان" : "Address"}</Label><Input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>{isRtl ? "الرقم الضريبي" : "Tax number"}</Label><Input value={form.taxNumber} onChange={(e)=>setForm({...form,taxNumber:e.target.value})}/></div><div className="space-y-2"><Label>{isRtl ? "شروط الدفع" : "Payment terms"}</Label><Input value={form.paymentTerms} onChange={(e)=>setForm({...form,paymentTerms:e.target.value})}/></div></div>
            <div className="space-y-2"><Label>{isRtl ? "ملاحظات" : "Notes"}</Label><Input value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">{isRtl ? "إلغاء" : "Cancel"}</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white">{saving ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : editing ? (isRtl ? "حفظ" : "Save") : (isRtl ? "إضافة" : "Add")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, suffix }: { icon: any; label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100 px-3 py-2.5 text-center">
      <Icon className="h-4 w-4 text-cyan-600 mx-auto mb-1" />
      <p className="text-sm font-black text-slate-900 tabular-nums leading-tight">{value}{suffix && <span className="text-[10px] font-bold text-slate-400"> {suffix}</span>}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
