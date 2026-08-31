/**
 * @file client/src/pages/Coupons.tsx
 * @description إدارة كوبونات الخصم
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Tag, Trash2, Power, Copy, Image, Pencil } from "lucide-react";
import { confirmDialog } from "@/lib/dialogs";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";

export default function Coupons() {
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const coupons = useQuery(api.coupons.list, { sessionToken }) || [];
  const createMutation = useMutation(api.coupons.create);
  const removeMutation = useMutation(api.coupons.remove);
  const toggleMutation = useMutation(api.coupons.toggleActive);
  const updateMutation = useMutation(api.coupons.update);

  const [dialogOpen, setDialogOpen] = useState(false);
  /* الحوار نفسه للإنشاء والتعديل: الحقول واحدة، والمعرَّف وحده يفرّق. */
  const [editId, setEditId] = useState<any>(null);
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
    minOrderQAR: "",
    restaurantKey: "ADRENALINE" as "ADRENALINE" | "NUTRI_RESET",
    durations: [] as string[],
  });

  const handleCreate = async () => {
    if (!form.code || !form.discountValue) {
      toast({ title: t("خطأ","Error"), description: t("املأ الحقول المطلوبة","Fill the required fields"), variant: "destructive" });
      return;
    }
    try {
      await createMutation({
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        minOrderQAR: form.minOrderQAR ? parseFloat(form.minOrderQAR) : undefined,
        restaurantKey: form.restaurantKey,
        durations: form.durations.length ? form.durations : undefined,
        sessionToken,
      });
      toast({ title: t("تم الإنشاء","Created"), description: `${t("كود","Code")} ${form.code} ${t("جاهز للاستخدام","is ready to use")}` });
      setForm({ code: "", discountType: "PERCENT", discountValue: "", maxUses: "", expiresAt: "", minOrderQAR: "", restaurantKey: "ADRENALINE", durations: [] });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: t("خطأ","Error"), description: e.message, variant: "destructive" });
    }
  };

  const blank = {
    code: "", discountType: "PERCENT" as "PERCENT" | "FIXED", discountValue: "",
    maxUses: "", expiresAt: "", minOrderQAR: "",
    restaurantKey: "ADRENALINE" as "ADRENALINE" | "NUTRI_RESET", durations: [] as string[],
  };

  const openNew = () => { setEditId(null); setForm(blank); setDialogOpen(true); };

  const openEdit = (c: any) => {
    setEditId(c._id);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue ?? ""),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      expiresAt: c.expiresAt || "",
      minOrderQAR: c.minOrderQAR != null ? String(c.minOrderQAR) : "",
      restaurantKey: c.restaurantKey || "ADRENALINE",
      durations: Array.isArray(c.durations) ? c.durations : [],
    });
    setDialogOpen(true);
  };

  /* الحقول الاختيارية تُرسَل null حين تُفرَّغ، لا undefined — وإلا فُهم
     المحوُ على أنه «لم يُمسّ» وبقيت القيمة القديمة. */
  const handleUpdate = async () => {
    if (!form.code || !form.discountValue) {
      toast({ title: t("خطأ","Error"), description: t("املأ الحقول المطلوبة","Fill the required fields"), variant: "destructive" });
      return;
    }
    try {
      await updateMutation({
        id: editId,
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
        minOrderQAR: form.minOrderQAR ? parseFloat(form.minOrderQAR) : null,
        restaurantKey: form.restaurantKey,
        durations: form.durations.length ? form.durations : null,
        sessionToken,
      });
      toast({ title: t("تم الحفظ","Saved"), description: form.code });
      setDialogOpen(false);
      setEditId(null);
    } catch (e: any) {
      toast({ title: t("خطأ","Error"), description: e.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: t("تم النسخ","Copied"), description: code });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<Tag className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="كوبونات الخصم" titleEn="Coupons"
        subtitleAr="إنشاء وإدارة أكواد الخصم" subtitleEn="Create & manage discount codes"
        actions={
          <Button onClick={openNew} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
            <Plus className="h-5 w-5" />
            {t("كوبون جديد","New coupon")}
          </Button>
        }
      />

      <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle>{t("الكوبونات","Coupons")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>{t("الكود","Code")}</TableHead>
                <TableHead>{t("النوع","Type")}</TableHead>
                <TableHead>{t("القيمة","Value")}</TableHead>
                <TableHead>{t("الاستخدام","Usage")}</TableHead>
                <TableHead>{t("الصلاحية","Expiry")}</TableHead>
                <TableHead>{t("الحالة","Status")}</TableHead>
                <TableHead>{t("إجراءات","Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t("لا توجد كوبونات","No coupons")}
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c: any) => (
                  <TableRow key={c._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{c.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(c.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.discountType === "PERCENT" ? t("نسبة %","Percent %") : t("مبلغ ثابت","Fixed")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-cyan-700">
                      {c.discountValue}
                      {c.discountType === "PERCENT" ? "%" : t(" ر.ق"," QAR")}
                    </TableCell>
                    <TableCell>
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                    </TableCell>
                    <TableCell className="text-xs" dir="ltr">{c.expiresAt || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`rounded-full ${c.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {c.isActive ? t("مفعّل","Active") : t("متوقف","Off")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          title={t("تعديل","Edit")}
                          className="text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation({ id: c._id, sessionToken })}
                          title={t("تفعيل/إيقاف","Enable/Disable")}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { window.location.href = `/promo-studio?code=${encodeURIComponent(c.code)}`; }}
                          title={t("تصميم إعلان", "Design campaign")}
                          className="text-[#0E76AC]"
                        >
                          <Image className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (await confirmDialog({
                              title: t("تأكيد الحذف", "Confirm Delete"),
                              message: `${t("حذف الكود","Delete code")} ${c.code}؟`,
                              variant: "danger",
                              confirmText: t("حذف", "Delete"),
                            })) removeMutation({ id: c._id, sessionToken });
                          }}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null); }}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editId ? t("تعديل الكوبون","Edit coupon") : t("كوبون خصم جديد","New discount coupon")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("كود الخصم","Discount code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("النوع","Type")}</Label>
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm({ ...form, discountType: e.target.value as any })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="PERCENT">{t("نسبة مئوية %","Percentage %")}</option>
                  <option value="FIXED">{t("مبلغ ثابت","Fixed amount")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{form.discountType === "PERCENT" ? t("النسبة (%)","Percentage (%)") : t("المبلغ (ر.ق)","Amount (QAR)")}</Label>
                <Input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.discountType === "PERCENT" ? "20" : "50"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("أقصى عدد استخدامات (اختياري)","Max uses (optional)")}</Label>
                <Input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("تاريخ الانتهاء (اختياري)","Expiry date (optional)")}</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("أقل قيمة اشتراك (اختياري)","Minimum subscription (optional)")}</Label>
                <Input
                  type="number"
                  value={form.minOrderQAR}
                  onChange={(e) => setForm({ ...form, minOrderQAR: e.target.value })}
                  placeholder={t("مثال: 1000","e.g. 1000")}
                />
              </div>
              <div className="space-y-2">
                {/* مُدد الاشتراك التي يسري عليها الكود. فارغةٌ = كل المدد.
                    الحملة قد تُوجَّه للشهري وحده لأن هامشه يحتمل الخصم. */}
                <Label>{t("يسري على","Applies to")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {([["month","الشهرية","Monthly"],["two_weeks","أسبوعين","2 weeks"],["week","أسبوع","1 week"]] as const).map(([key,ar,en]) => {
                    const on = form.durations.includes(key);
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm({ ...form, durations: on
                          ? form.durations.filter((d) => d !== key)
                          : [...form.durations, key] })}
                        className={cn("rounded-lg border px-2.5 py-2 text-[11px] font-black",
                          on ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 bg-white text-slate-600")}>
                        {t(ar, en)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  {form.durations.length
                    ? t("يسري على المحدَّد فقط", "Applies only to the selected")
                    : t("لم تحدّد شيئاً — يسري على كل المدد", "Nothing selected — applies to all durations")}
                </p>
              </div>
              <div className="space-y-2">
                {/* الكود يسري على مطعمٍ واحد: خصمُ حملةٍ لأدرينالين لا يُصرف على
                    باقات نيوتري ريست ولو كتبه المشترك هناك. */}
                <Label>{t("المطعم","Restaurant")}</Label>
                <div className="flex gap-2">
                  {(["ADRENALINE", "NUTRI_RESET"] as const).map((k) => (
                    <button key={k} type="button"
                      onClick={() => setForm({ ...form, restaurantKey: k })}
                      className={cn("flex-1 rounded-xl border px-2 py-2 text-xs font-black",
                        form.restaurantKey === k
                          ? k === "NUTRI_RESET" ? "border-[#22AEC0] bg-[#22AEC0] text-white" : "border-[#0E76AC] bg-[#0E76AC] text-white"
                          : "border-slate-200 bg-white text-slate-600")}>
                      {k === "NUTRI_RESET" ? "Nutri Reset" : "Adrenaline"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("إلغاء","Cancel")}
            </Button>
            <Button onClick={editId ? handleUpdate : handleCreate}>
              {editId ? t("حفظ التعديل","Save changes") : t("إنشاء الكوبون","Create coupon")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
