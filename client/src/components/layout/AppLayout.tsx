import { Sidebar } from "./Sidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { currentUser } = useStore();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { dir, language } = useLanguage();

  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  // ✅ تحكم في عرض السايدبار على الديسكتوب
  const SIDEBAR_W = "14rem"; // 224px

  useEffect(() => {
    if (!currentUser && location !== "/login") {
      setLocation("/login");
    }
  }, [currentUser, location, setLocation]);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [location, isMobile]);

  if (!currentUser) return null;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="h-screen w-full bg-background overflow-hidden"
    >
      {/* ✅ Desktop */}
      {!isMobile ? (
        <div className="h-full w-full flex overflow-hidden">
          {/* Sidebar - positioned by dir attribute */}
          <aside
            className={cn(
              "h-full bg-sidebar overflow-hidden shrink-0 border-sidebar-border",
              isRtl ? "border-l" : "border-r"
            )}
            style={{ width: SIDEBAR_W }}
          >
            <Sidebar />
          </aside>

          {/* Main Content */}
          <main className="relative h-full flex-1 min-w-0 overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />

            <div className="flex-1 h-full w-full overflow-y-auto overflow-x-auto">
              <div className="w-full min-w-0 p-4 md:p-8">{children}</div>
            </div>
          </main>
        </div>
      ) : (
        /* ✅ Mobile */
        <div className="h-full w-full flex flex-col overflow-hidden">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent
              side={isRtl ? "right" : "left"}
              className="p-0 w-72 sm:w-80 border-0"
            >
              <Sidebar />
            </SheetContent>
          </Sheet>

          {/* Top mobile bar */}
          <div className="h-14 border-b-2 border-cyan-200 flex items-center px-4 bg-gradient-to-r from-cyan-50 to-blue-50 sticky top-0 z-20 shadow-lg">
            <img 
              src="/heart-icon.png" 
              alt="Adrenaline" 
              className="h-8 w-8"
            />
            <img 
              src="/adrenaline-logo.png" 
              alt="Adrenaline Healthy Food" 
              className={cn("h-5 w-auto", isRtl ? "mr-2" : "ml-2")}
            />
          </div>

          <main className="relative flex-1 min-w-0 overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />

            <div className="h-full w-full overflow-y-auto overflow-x-auto pb-20">
              <div className="w-full min-w-0 p-3 sm:p-4">{children}</div>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}
