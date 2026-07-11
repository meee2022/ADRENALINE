/**
 * @file client/src/components/NotificationBell.tsx
 * @description جرس إشعارات + قائمة منسدلة - يظهر للموظفين حسب الدور
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { Link } from "wouter";
import { Bell, CheckCheck, ChefHat, Truck, ClipboardList, Sparkles, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

import { useLanguage } from "@/lib/i18n";

const TYPE_ICON: Record<string, any> = {
  NEW_ORDER: ClipboardList,
  ORDER_APPROVED: Sparkles,
  PLAN_CONFIRMED: Sparkles,
  MEAL_PREPARED: ChefHat,
  MEAL_DELIVERED: Truck,
  LOW_STOCK: AlertTriangle,
  SYSTEM: Bell,
};

const TYPE_COLOR: Record<string, string> = {
  NEW_ORDER: "#3CC4F0",
  ORDER_APPROVED: "#10b981",
  PLAN_CONFIRMED: "#10b981",
  MEAL_PREPARED: "#f59e0b",
  MEAL_DELIVERED: "#8b5cf6",
  LOW_STOCK: "#ef4444",
  SYSTEM: "#64748b",
};

export function NotificationBell() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { currentUser } = useStore();
  const [open, setOpen] = useState(false);
  const role = currentUser?.role as any;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const { dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  // بلا توكن لا معنى للاستعلام: السيرفر سيرميه ويسقط التطبيق كله.
  // (يحدث عندما يبقى currentUser في التخزين بينما بطلت الجلسة على السيرفر.)
  const canQuery = Boolean(role && sessionToken);

  const notifications = useQuery(
    api.notifications.listForRole,
    canQuery ? { role, onlyUnread: false, sessionToken } : "skip",
  ) || [];

  const unreadCount = useQuery(
    api.notifications.unreadCount,
    canQuery ? { role, sessionToken } : "skip",
  ) || 0;

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // حساب موضع الـ dropdown بناءً على موضع الزر بشكل ديناميكي وقوي
  useEffect(() => {
    if (!open || !btnRef.current) return;

    const updatePosition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      // ✅ العرض يتقلّص على الشاشات الصغيرة فلا يخرج عن الشاشة (بحدّ أقصى 320)
      const dropW = Math.min(320, window.innerWidth - 16);

      // حساب الإزاحة لليمين أو اليسار بناءً على اتجاه اللغة
      let left = isRtl ? rect.right - dropW : rect.left;
      
      // ضمان بقاء القائمة داخل حدود الشاشة
      if (left < 8) left = 8;
      if (left + dropW > window.innerWidth - 8) {
        left = window.innerWidth - dropW - 8;
      }

      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width: dropW,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, isRtl]);

  // ✅ العدّاد يتصفّر بعد ما تشوف الإشعارات: عند إغلاق الجرس نعلّم الكل كمقروء
  //    (تبقى الإشعارات في القائمة، بس العدّاد الأحمر يرجع صفر — لا يتراكم بلا نهاية).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open && canQuery && unreadCount > 0) {
      markAllAsRead({ role, sessionToken }).catch(() => {});
    }
    wasOpenRef.current = open;
  }, [open, canQuery, unreadCount, role, sessionToken]);

  if (!role) return null;

  const dropdown = open ? (
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
      <div
        dir="rtl"
        style={dropdownStyle}
        className="fixed z-[9999] w-[320px] max-h-[480px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-cyan-50 to-blue-50">
          <h3 className="font-bold text-slate-800 text-sm">الإشعارات</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead({ role, sessionToken })}
              className="text-[11px] text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              تعليم الكل كمقروء
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              لا توجد إشعارات
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n: any) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                const color = TYPE_COLOR[n.type] || "#64748b";
                return (
                  <NotificationItem
                    key={n._id}
                    n={n}
                    Icon={Icon}
                    color={color}
                    onClick={() => {
                      if (!n.isRead) markAsRead({ id: n._id, sessionToken });
                      setOpen(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-sidebar-accent transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
}

function NotificationItem({
  n,
  Icon,
  color,
  onClick,
}: {
  n: any;
  Icon: any;
  color: string;
  onClick: () => void;
}) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar });
    } catch {
      return "";
    }
  })();

  const content = (
    <div
      onClick={onClick}
      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
        !n.isRead ? "bg-cyan-50/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{n.title}</p>
          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
          <p className="text-[10px] text-slate-400 mt-1">{timeAgo}</p>
        </div>
        {!n.isRead && (
          <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0 mt-2" />
        )}
      </div>
    </div>
  );

  if (n.link) {
    return <Link href={n.link}>{content}</Link>;
  }
  return content;
}
