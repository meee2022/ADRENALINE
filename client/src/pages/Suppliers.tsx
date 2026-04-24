/**
 * @file client/src/pages/Suppliers.tsx
 * @description صفحة إدارة الموردين
 */
import { useState } from "react";
import { useSuppliers, useCreateSupplier, type Supplier } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Phone, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

export default function SuppliersPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();

  const { data: suppliers = [], isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "الاسم مطلوب" : "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
      });

      toast({
        title: isRtl ? "تمت الإضافة" : "Added",
        description: isRtl ? "تم إضافة المورد بنجاح" : "Supplier added successfully",
      });

      setShowAddModal(false);
      setFormData({ name: "", phone: "" });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشلت العملية" : "Operation failed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isRtl ? "إدارة الموردين" : "Suppliers Management"}
                </h1>
                <p className="text-sm text-gray-500">
                  {isRtl ? "إدارة قائمة الموردين" : "Manage suppliers list"}
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowAddModal(true)}
              className="h-11 rounded-xl bg-purple-500 hover:bg-purple-600 text-white shadow-md"
            >
              <Plus className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "إضافة مورد" : "Add Supplier"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Stats Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{isRtl ? "إجمالي الموردين" : "Total Suppliers"}</p>
              <p className="text-3xl font-bold text-gray-900">{suppliers.length}</p>
            </div>
            <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Suppliers List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">{isRtl ? "جاري التحميل..." : "Loading..."}</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">{isRtl ? "لا يوجد موردين" : "No suppliers"}</p>
              <Button
                onClick={() => setShowAddModal(true)}
                variant="outline"
                className="mt-4"
              >
                {isRtl ? "إضافة أول مورد" : "Add First Supplier"}
              </Button>
            </div>
          ) : (
            suppliers.map((supplier) => (
              <div
                key={supplier._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {supplier.name}
                    </h3>
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                  </div>

                  <Badge variant="secondary" className="text-sm">
                    <Package className={cn("h-4 w-4", isRtl ? "ml-1" : "mr-1")} />
                    {isRtl ? "مورد نشط" : "Active"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className={cn("sm:max-w-[400px]", isRtl && "rtl")}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "إضافة مورد جديد" : "Add New Supplier"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>
                {isRtl ? "اسم المورد" : "Supplier Name"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                placeholder={isRtl ? "مثال: مزارع اليوم" : "e.g. Fresh Farms"}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={isRtl ? "text-right" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "رقم الهاتف (اختياري)" : "Phone (Optional)"}</Label>
              <Input
                type="tel"
                placeholder={isRtl ? "+974 XXXX XXXX" : "+974 XXXX XXXX"}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={isRtl ? "text-right" : ""}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-purple-500 hover:bg-purple-600"
              >
                {isRtl ? "إضافة" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
