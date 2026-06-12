/**
 * @file HeroPreview.tsx
 * @description صفحة مؤقتة لمقارنة نسختي الهيرو (نظيف Premium + Split عصري).
 *  المسار: /public/hero-preview
 */
import { useLocation } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HeroClean } from "@/components/public/HeroClean";
import { HeroSplit } from "@/components/public/HeroSplit";

export default function HeroPreview() {
  const [, setLocation] = useLocation();
  const meals = useQuery(api.publicMeals.list) || [];
  const withImg = meals.filter((m: any) => m.imageUrl);
  const heroImages = (withImg.slice(0, 5).map((m: any) => m.imageUrl)).filter(Boolean);
  const dish = withImg[1] || withImg[0] || {};

  const heroImgs = heroImages.length ? heroImages : ["/1.png", "/2.png", "/3.png"];
  const dishImg = dish.imageUrl || "/2.png";

  const T = {
    titleAr: "طعام صحي بمذاق لا يُقاوم",
    titleEn: "Healthy Food That Tastes Amazing",
    subtitleAr: "وجبات طازجة محسوبة السعرات تُحضَّر يومياً بإشراف أخصائيي تغذية — وتوصَّل لباب بيتك في قطر.",
    subtitleEn: "Fresh, calorie-counted meals prepared daily by nutritionists — delivered to your door in Qatar.",
  };

  const onSub = () => setLocation("/public/plans");
  const onMenu = () => setLocation("/public/menu");
  const onSmart = () => setLocation("/customer/smart-plan");

  const Label = ({ n, title }: { n: string; title: string }) => (
    <div style={{ background: "#0E2A4A", color: "#fff", padding: "10px 20px", display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ background: "#3AC7F4", color: "#0E2A4A", fontWeight: 900, borderRadius: 8, padding: "2px 10px" }}>{n}</span>
      <span style={{ fontFamily: "'Cairo',sans-serif", fontWeight: 800 }}>{title}</span>
    </div>
  );

  return (
    <PublicLayout>
      <Label n="A" title="هيرو نظيف Premium — كاروسيل صور حقيقية" />
      <HeroClean images={heroImgs} {...T} onSubscribeClick={onSub} onMenuClick={onMenu} onSmartPlanClick={onSmart} />

      <Label n="B" title="هيرو Split عصري — كارت طبق حقيقي" />
      <HeroSplit image={dishImg} dishNameAr={dish.nameAr} dishNameEn={dish.nameEn}
        dishKcal={dish.calories} {...T} onSubscribeClick={onSub} onMenuClick={onMenu} onSmartPlanClick={onSmart} />

      <div style={{ textAlign: "center", padding: "30px", fontFamily: "'Cairo',sans-serif", color: "#0E2A4A" }}>
        قارن النسختين فوق — قولّي A ولا B وأركّبها في الصفحة الرئيسية.
      </div>
    </PublicLayout>
  );
}
