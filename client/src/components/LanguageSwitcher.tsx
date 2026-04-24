import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleLanguage}
      className="flex items-center gap-2"
    >
      <Languages className="h-4 w-4" />
      <span>{language === 'ar' ? 'English' : 'عربي'}</span>
    </Button>
  );
}
