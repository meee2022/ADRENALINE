import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function NotFound() {
  const { dir } = useLanguage();
  const isRtl = (dir ?? "rtl") === "rtl";
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="flex flex-col items-center gap-3 mb-2">
            <AlertCircle className="h-12 w-12 text-[#3CC4F0]" />
            <h1 className="text-3xl font-bold text-gray-900">404</h1>
            <h2 className="text-lg font-bold text-gray-700">
              {isRtl ? "الصفحة غير موجودة" : "Page Not Found"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {isRtl
              ? "عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها."
              : "Sorry, the page you're looking for doesn't exist or was moved."}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full font-bold text-white"
            style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)" }}
          >
            <Home className="h-4 w-4" />
            {isRtl ? "العودة للرئيسية" : "Back to Home"}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
