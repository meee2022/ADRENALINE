/**
 * @file client/src/pages/Users.tsx
 * @description صفحة إدارة حسابات المستخدمين
 * @convex users.ts
 */
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { confirmDialog } from "@/lib/dialogs";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UserPlus, Shield, Users as UsersIcon, ArrowUpCircle, ChefHat, Truck, HeartPulse, Package, UserCog, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { convex } from "@/lib/convex";
import { api } from "@/../../convex/_generated/api";
import type { Id } from "@/../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { Role } from "@/lib/types";
import { ALL_PAGES, ALL_ROLES, ROLE_LABEL, defaultPermsForRole } from "@/lib/permissions";

function userInitials(name?: string) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

/** خانة كلمة مرور مع زر عين لإظهار/إخفاء القيمة. */
function PasswordField({
  id, value, onChange, placeholder = "••••••••",
}: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="pe-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-700"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: string[];
}

export default function Users() {
  const { t, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"staff" | "customers">("staff");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [promoteCustomer, setPromoteCustomer] = useState<any>(null);
  const [promoteRole, setPromoteRole] = useState<Role>("NUTRITIONIST");
  const [promotePassword, setPromotePassword] = useState("");
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    role: "DELIVERY",
    permissions: defaultPermsForRole("DELIVERY"),
  });

  // اختيار دور → يعبّي الصفحات الافتراضية (يقدر يعدّلها بعدها)
  const pickRole = (role: Role) => setFormData((f) => ({ ...f, role, permissions: defaultPermsForRole(role) }));
  const togglePerm = (href: string) => setFormData((f) => ({
    ...f,
    permissions: f.permissions.includes(href) ? f.permissions.filter((p) => p !== href) : [...f.permissions, href],
  }));
  // الصفحات مجمّعة بالأقسام للـchecklist
  const groupedPages = (() => {
    const m = new Map<string, typeof ALL_PAGES>();
    for (const p of ALL_PAGES) {
      const key = isRtl ? p.sectionAr : p.sectionEn;
      if (!m.has(key)) m.set(key, [] as any);
      (m.get(key) as any).push(p);
    }
    return Array.from(m.entries());
  })();
  // قسم الدور + قائمة الصفحات المسموحة (مشترك بين إضافة/تعديل)
  const roleAndPerms = (
    <>
      <div className="space-y-2">
        <Label>{t("users.role")}</Label>
        <Select value={formData.role} onValueChange={(v) => pickRole(v as Role)} dir={isRtl ? "rtl" : "ltr"}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{isRtl ? ROLE_LABEL[r].ar : ROLE_LABEL[r].en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-gray-400">{isRtl ? "يحدّد الدور الصفحات الافتراضية، ويمكنك تخصيصها أدناه" : "Role sets default pages — customize below"}</p>
      </div>
      {formData.role === "ADMIN" ? (
        <p className="text-xs font-bold text-emerald-600">{isRtl ? "المسؤول (ADMIN) عنده كل الصلاحيات تلقائيًا." : "Admin has full access automatically."}</p>
      ) : (
        <div className="space-y-2">
          <Label>{isRtl ? "الصفحات المسموحة لهذا الحساب" : "Pages this account can access"}</Label>
          <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 p-2 space-y-2">
            {groupedPages.map(([title, pages]) => (
              <div key={title}>
                <div className="text-[11px] font-bold text-[#47759c] px-1 mb-1">{title}</div>
                {pages.map((p) => (
                  <label key={p.href} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.permissions.includes(p.href)} onChange={() => togglePerm(p.href)} className="h-4 w-4 accent-[#0E76AC]" />
                    <span className="text-sm">{isRtl ? p.labelAr : p.labelEn}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">{formData.permissions.length} {isRtl ? "صفحة مختارة" : "pages selected"}</p>
        </div>
      )}
    </>
  );

  // Promote-to-staff mutation
  const createUserMutation = useMutation(api.users.createUser);

  const openPromoteDialog = (customer: any) => {
    setPromoteCustomer(customer);
    setPromoteRole("NUTRITIONIST");
    setPromotePassword("");
    setIsPromoteDialogOpen(true);
  };

  const handlePromote = async () => {
    if (!promoteCustomer) return;
    if (!promotePassword || promotePassword.length < 4) {
      toast({
        title: isRtl ? "كلمة المرور قصيرة" : "Password too short",
        description: isRtl ? "كلمة المرور 4 أحرف على الأقل" : "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }
    try {
      await createUserMutation({
        email: promoteCustomer.email,
        password: promotePassword,
        name: promoteCustomer.fullName,
        role: promoteRole,
        sessionToken,
      });
      toast({
        title: isRtl ? "تم الرفع بنجاح" : "Promoted successfully",
        description: isRtl
          ? `${promoteCustomer.fullName} أصبح موظفاً بدور ${getRoleLabel(promoteRole)}`
          : `${promoteCustomer.fullName} is now staff (${getRoleLabel(promoteRole)})`,
      });
      setIsPromoteDialogOpen(false);
      setActiveTab("staff");
    } catch (e: any) {
      toast({
        title: isRtl ? "فشل الرفع" : "Failed",
        description: e?.message || (isRtl ? "حصل خطأ" : "Something went wrong"),
        variant: "destructive",
      });
    }
  };

  // 🔒 توكن الجلسة يُرسل مع العمليات الحسّاسة
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  // Fetch users from Convex
  const users = useQuery(api.users.listUsers, { sessionToken }) || [];
  const customers = useQuery(api.customerAuth.listCustomers, { sessionToken }) || [];

  const handleAdd = () => {
    setFormData({ name: "", email: "", password: "", role: "DELIVERY", permissions: defaultPermsForRole("DELIVERY") });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (user: any) => {
    setSelectedUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      permissions: (user.permissions && user.permissions.length) ? user.permissions : defaultPermsForRole(user.role),
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!(await confirmDialog({ message: t("users.delete_confirm"), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;

    try {
      await convex.mutation(api.users.deleteUser, { userId: userId as Id<"users">, sessionToken });
      toast({
        title: isRtl ? "تم الحذف" : "Deleted",
        description: isRtl ? "تم حذف المستخدم بنجاح" : "User deleted successfully",
      });
    } catch (error) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "حدث خطأ أثناء الحذف" : "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleSaveAdd = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "يرجى ملء جميع الحقول" : "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await convex.mutation(api.users.createUser, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        permissions: formData.permissions,
        sessionToken,
      });

      toast({
        title: isRtl ? "تم الإضافة" : "Added",
        description: isRtl ? "تم إضافة المستخدم بنجاح" : "User added successfully",
      });

      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error.message || (isRtl ? "حدث خطأ أثناء الإضافة" : "Failed to add user"),
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUserId || !formData.name || !formData.email) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "يرجى ملء جميع الحقول" : "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await convex.mutation(api.users.updateUser, {
        userId: selectedUserId as Id<"users">,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        permissions: formData.permissions,
        sessionToken,
      });

      // If password is provided, update it separately
      if (formData.password) {
        await convex.mutation(api.users.changePassword, {
          userId: selectedUserId as Id<"users">,
          newPassword: formData.password,
          sessionToken,
        });
      }

      toast({
        title: isRtl ? "تم التحديث" : "Updated",
        description: isRtl ? "تم تحديث المستخدم بنجاح" : "User updated successfully",
      });

      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error.message || (isRtl ? "حدث خطأ أثناء التحديث" : "Failed to update user"),
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await convex.mutation(api.users.updateUserStatus, {
        userId: userId as Id<"users">,
        isActive: !currentStatus,
        sessionToken,
      });

      toast({
        title: isRtl ? "تم التحديث" : "Updated",
        description: isRtl
          ? "تم تحديث حالة المستخدم"
          : "User status updated successfully",
      });
    } catch (error) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "حدث خطأ أثناء التحديث" : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800 border-red-200";
      case "KITCHEN":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "DELIVERY":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "NUTRITIONIST":
        return "bg-green-100 text-green-800 border-green-200";
      case "INVENTORY_MANAGER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRoleLabel = (role: Role) => isRtl ? (ROLE_LABEL[role]?.ar || role) : (ROLE_LABEL[role]?.en || role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={<UserCog className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr={t("users.title")} titleEn={t("users.title")}
        subtitleAr={t("users.subtitle")} subtitleEn={t("users.subtitle")}
        actions={
          <Button onClick={handleAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2">
            <UserPlus className="h-5 w-5" />
            {t("users.add")}
          </Button>
        }
        kpis={[
          { value: users.length, labelAr: "الموظفين", labelEn: "Staff" },
          { value: customers.length, labelAr: "العملاء", labelEn: "Customers" },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "staff"
              ? "border-b-2 border-[#3CC4F0] text-[#3CC4F0]"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {isRtl ? "الموظفين" : "Staff"} ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "customers"
              ? "border-b-2 border-[#3CC4F0] text-[#3CC4F0]"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {isRtl ? "العملاء" : "Customers"} ({customers.length})
        </button>
      </div>

      {/* Staff Table */}
      {activeTab === "staff" && (
        <Card className="rounded-2xl border-0 shadow-none bg-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("users.title")}
            </CardTitle>
            <CardDescription>{users.length} {isRtl ? "مستخدم" : "users"}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.name")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead className="text-center">{t("users.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex min-w-[180px] items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#3cc4f0]/25 bg-[#e8f8fd] text-xs font-black text-[#12698c] shadow-sm">{userInitials(user.name)}</span>
                      <div className="min-w-0"><p className="truncate font-extrabold text-[#0f2738]">{user.name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">#{String(user.id).slice(-6)}</p></div>
                    </div>
                  </TableCell>
                  <TableCell className="text-start" dir="ltr">
                    <span className="font-medium text-slate-600">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)} variant="outline">
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(user.id, user.isActive)}
                      className="h-7"
                    >
                      <Badge
                        variant={user.isActive ? "default" : "secondary"}
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                        }
                      >
                        {user.isActive ? t("users.active") : t("users.inactive")}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        className="h-9 w-9 rounded-xl text-slate-500 hover:bg-[#e8f8fd] hover:text-[#12698c]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id)}
                        className="h-9 w-9 rounded-xl text-destructive hover:bg-rose-50 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      )}

      {/* Customers Table */}
      {activeTab === "customers" && (
        <Card className="rounded-2xl border-0 shadow-none bg-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              {isRtl ? "حسابات العملاء" : "Customer Accounts"}
            </CardTitle>
            <CardDescription>{customers.length} {isRtl ? "عميل" : "customers"}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRtl ? "الاسم الكامل" : "Full Name"}</TableHead>
                  <TableHead>{isRtl ? "البريد الإلكتروني" : "Email"}</TableHead>
                  <TableHead>{isRtl ? "الهاتف" : "Phone"}</TableHead>
                  <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRtl ? "تاريخ التسجيل" : "Registered"}</TableHead>
                  <TableHead>{isRtl ? "مرتبط باشتراك" : "Linked to Subscription"}</TableHead>
                  <TableHead className="text-center">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {isRtl ? "لا يوجد عملاء مسجلين" : "No registered customers"}
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer: any) => {
                    const alreadyStaff = users.some((u: any) => u.email === customer.email);
                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex min-w-[180px] items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#3cc4f0]/25 bg-[#e8f8fd] text-xs font-black text-[#12698c] shadow-sm">{userInitials(customer.fullName)}</span><div className="min-w-0"><p className="truncate font-extrabold text-[#0f2738]">{customer.fullName}</p><p className="mt-0.5 text-[10px] text-slate-400" dir="ltr">{customer.phone}</p></div></div>
                        </TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              customer.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {customer.isActive ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير نشط" : "Inactive")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="tabular-nums" dir="ltr">
                            {new Date(customer.createdAt).toLocaleDateString("en-GB")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {customer.customerId ? (
                            <span className="text-green-600 font-medium">✓ {isRtl ? "مرتبط" : "Linked"}</span>
                          ) : (
                            <span className="text-gray-400">{isRtl ? "غير مرتبط" : "Not linked"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            {alreadyStaff ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                {isRtl ? "موظف بالفعل" : "Already staff"}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPromoteDialog(customer)}
                                className="h-8 gap-1.5 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white"
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                                <span className="text-xs">{isRtl ? "رفع لموظف" : "Promote to staff"}</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users.add_title")}</DialogTitle>
            <DialogDescription>{t("users.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("users.name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isRtl ? "أحمد محمد" : "John Doe"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("users.email")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("users.password")}</Label>
              <PasswordField
                id="password"
                value={formData.password}
                onChange={(v) => setFormData({ ...formData, password: v })}
              />
            </div>

            {roleAndPerms}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {t("users.cancel")}
            </Button>
            <Button onClick={handleSaveAdd}>{t("users.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users.edit_title")}</DialogTitle>
            <DialogDescription>{t("users.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("users.name")}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">{t("users.email")}</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                dir="ltr"
                className="text-left"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">{t("users.password")}</Label>
              <PasswordField
                id="edit-password"
                value={formData.password}
                onChange={(v) => setFormData({ ...formData, password: v })}
              />
              <p className="text-xs text-muted-foreground">{t("users.password_note")}</p>
            </div>

            {roleAndPerms}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("users.cancel")}
            </Button>
            <Button onClick={handleSaveEdit}>{t("users.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Promote Customer to Staff Dialog ─── */}
      <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-[#3CC4F0]" />
              {isRtl ? "رفع عميل إلى موظف" : "Promote Customer to Staff"}
            </DialogTitle>
            <DialogDescription>
              {isRtl ? "تحويل العميل إلى حساب موظف بدور محدد" : "Convert the customer into a staff account with a specific role"}
            </DialogDescription>
          </DialogHeader>

          {promoteCustomer && (
            <div className="space-y-4 py-4">
              {/* Customer info card */}
              <div className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "#3CC4F010", border: "1px solid #3CC4F030" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                  {promoteCustomer.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#0F1516] truncate">{promoteCustomer.fullName}</p>
                  <p className="text-xs text-[#47759C] truncate" dir="ltr">{promoteCustomer.email}</p>
                </div>
              </div>

              {/* Role selection */}
              <div className="space-y-2">
                <Label>{isRtl ? "اختر الدور" : "Select role"}</Label>
                <Select value={promoteRole} onValueChange={(v) => setPromoteRole(v as Role)} dir={isRtl ? "rtl" : "ltr"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">
                      <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t("role.admin")}</span>
                    </SelectItem>
                    <SelectItem value="NUTRITIONIST">
                      <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4" /> {t("role.nutritionist")}</span>
                    </SelectItem>
                    <SelectItem value="KITCHEN">
                      <span className="flex items-center gap-2"><ChefHat className="h-4 w-4" /> {t("role.kitchen")}</span>
                    </SelectItem>
                    <SelectItem value="DELIVERY">
                      <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> {t("role.delivery")}</span>
                    </SelectItem>
                    <SelectItem value="INVENTORY_MANAGER">
                      <span className="flex items-center gap-2"><Package className="h-4 w-4" /> {t("role.inventory_manager")}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>{isRtl ? "كلمة المرور الجديدة (للدخول كموظف)" : "New password (for staff login)"}</Label>
                <PasswordField
                  value={promotePassword}
                  onChange={(v) => setPromotePassword(v)}
                  placeholder={isRtl ? "4 أحرف على الأقل" : "At least 4 characters"}
                />
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "سيستخدم العميل البريد الإلكتروني نفسه مع كلمة المرور هذه لتسجيل الدخول بصفته موظفًا." : "The customer will use the same email with this password to log in as staff."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromoteDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handlePromote} className="bg-[#3CC4F0] hover:bg-[#2bb0dc] gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              {isRtl ? "تأكيد الرفع" : "Confirm promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
