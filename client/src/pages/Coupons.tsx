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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Tag, Trash2, Power, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useStore } from "@/lib/store";

export default function Coupons() {
  const { toast } = useToast();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const coupons = useQuery(api.coupons.list) || [];
  const createMutation = useMutation(api.coupons.create);
  const removeMutation = useMutation(api.coupons.remove);
  const toggleMutation = useMutation(api.coupons.toggleActive);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
  });

  const handleCreate = async () => {
    if (!form.code || !form.discountValue) {
      toast({ title: "خطأ", description: "املأ الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation({
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        sessionToken,
      });
      toast({ title: "تم الإنشاء", description: `كود ${form.code} جاهز للاستخدام` });
      setForm({ code: "", discountType: "PERCENT", discountValue: "", maxUses: "", expiresAt: "" });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "تم النسخ", description: code });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<Tag className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="كوبونات الخصم" titleEn="Coupons"
        subtitleAr="إنشاء وإدارة أكواد الخصم" subtitleEn="Create & manage discount codes"
        actions={
          <Button onClick={() => setDialogOpen(true)} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
            <Plus className="h-5 w-5" />
            كوبون جديد
          </Button>
        }
      />

      <Card className="rounded-2xl" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle>الكوبونات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl overflow-hidden border border-[#e8eef4] overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#f4f8fb] [&_th]:text-[#47759c] [&_th]:font-bold [&_th]:text-xs [&_th]:uppercase">
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>القيمة</TableHead>
                <TableHead>الاستخدام</TableHead>
                <TableHead>الصلاحية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    لا توجد كوبونات
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
                        {c.discountType === "PERCENT" ? "نسبة %" : "مبلغ ثابت"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-cyan-700">
                      {c.discountValue}
                      {c.discountType === "PERCENT" ? "%" : " ر.ق"}
                    </TableCell>
                    <TableCell>
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                    </TableCell>
                    <TableCell className="text-xs" dir="ltr">{c.expiresAt || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`rounded-full ${c.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {c.isActive ? "مفعّل" : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation({ id: c._id, sessionToken })}
                          title="تفعيل/إيقاف"
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`حذف الكود ${c.code}؟`)) removeMutation({ id: c._id, sessionToken });
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>كوبون خصم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>كود الخصم</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>النوع</Label>
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm({ ...form, discountType: e.target.value as any })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="PERCENT">نسبة مئوية %</option>
                  <option value="FIXED">مبلغ ثابت</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{form.discountType === "PERCENT" ? "النسبة (%)" : "المبلغ (ر.ق)"}</Label>
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
                <Label>أقصى عدد استخدامات (اختياري)</Label>
                <Input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء (اختياري)</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate}>إنشاء الكوبون</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
