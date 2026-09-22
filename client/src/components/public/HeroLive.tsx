/**
 * @file HeroLive.tsx
 * @description هيرو الموقع بنفس فكرة هيرو التطبيق (apps/mobile/src/components/HomeHero.tsx):
 *  شرائح تتبدّل — إعلانات من صفحة البانرات أولاً ثم أطباق مقصوصة تدخل بدوران خفيف.
 *  المصدر واحد: banners:listAppSlides على Convex، فما يُفعَّل في اللوحة يظهر في التطبيق والموقع معاً.
 *  بلا أطباق من اللوحة تُعرض الأطباق الاثنا عشر نفسها التي في التطبيق (client/public/hero).
 *  عرض فقط: لا يلمس أي منطق اشتراكات أو خطط.
 */
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";

type Slide = { key: string; kind: "dish" | "promo"; src: string; ar: string; en?: string; link?: string };

const DISHES: Slide[] = ([
  ["steak", "ستيك بزبدة الثوم والبطاطس", "Garlic Butter Steak & Potato"],
  ["caesar", "سلطة سيزر", "Caesar Salad"],
  ["salmon", "سلمون بالعسل", "Honey Glaze Salmon"],
  ["pancake", "بان كيك بالشوكولاتة", "Chocolate Pancake"],
  ["burger", "برغر الدجاج المشوي", "Grilled Chicken Burger"],
  ["shrimp-pasta", "باستا روبيان كاجون", "Cajun Shrimp Pasta"],
  ["beet-salad", "سلطة الشمندر", "Beetroot Salad"],
  ["teriyaki", "ترياكي الدجاج", "Chicken Teriyaki Bowl"],
  ["dates-balls", "كرات التمر", "Dates Balls"],
  ["wrap", "ساندويتش فاهيتا الدجاج", "Chicken Fajita Sandwich"],
  ["parmesan", "دجاج بارميزان", "Chicken Parmesan"],
  ["lava-cake", "كيكة اللافا الباهاما", "Bahama Lava Cake"],
] as const).map(([key, ar, en]) => ({ key, kind: "dish" as const, src: `/hero/${key}.webp`, ar, en }));

const BG = "#47759C";
const NAVY = "#0E2A4A";

interface Props { onPlans: () => void; onMenu: () => void; onSmartPlan?: () => void }

export function HeroLive({ onPlans, onMenu, onSmartPlan }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const reduced = useReducedMotion();
  const live = useQuery((api as any).banners.listAppSlides, {}) as any[] | undefined;

  // نفس قاعدة التطبيق: شرائح اللوحة أولاً، والأطباق المدمجة تبقى ما لم تُرفع أطباق من اللوحة.
  const slides = React.useMemo<Slide[]>(() => {
    const fromBoard: Slide[] = (live || []).map((b) => ({
      key: String(b.id), kind: b.kind === "dish" ? "dish" : "promo", src: b.imageUrl,
      ar: b.titleAr, en: b.titleEn, link: b.linkUrl,
    }));
    return fromBoard.some((s) => s.kind === "dish") ? fromBoard : [...fromBoard, ...DISHES];
  }, [live]);

  const [index, setIndex] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [paused, setPaused] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => { setIndex((i) => (slides.length ? i % slides.length : 0)); }, [slides.length]);
  React.useEffect(() => {
    if (paused || hover || reduced || slides.length < 2) return;
    const t = setInterval(() => { setDir(1); setIndex((i) => (i + 1) % slides.length); }, 6500);
    return () => clearInterval(t);
  }, [paused, hover, reduced, slides.length]);

  const current = slides[index % Math.max(slides.length, 1)];
  const go = (step: number) => { setPaused(true); setDir(step); setIndex((i) => (i + step + slides.length) % slides.length); };
  // الأسهم تتبع اتجاه القراءة: «التالي» يسار في العربية.
  const Next = ar ? ChevronLeft : ChevronRight, Prev = ar ? ChevronRight : ChevronLeft;
  const promo = current?.kind === "promo";
  const name = current ? (ar ? current.ar : current.en || current.ar) : "";
  const shift = (ar ? -1 : 1) * 170 * dir;

  const art = current && (
    <img src={current.src} alt={name} draggable={false}
      className={promo ? "absolute inset-0 h-full w-full object-cover rounded-[22px] shadow-2xl" : "absolute inset-0 h-full w-full object-contain drop-shadow-[0_30px_40px_rgba(7,19,31,.45)]"} />
  );

  return (
    <section dir={ar ? "rtl" : "ltr"} className="relative overflow-hidden" style={{ background: BG }}>
      <div aria-hidden className="pointer-events-none absolute -top-40 end-[-10%] h-[520px] w-[520px] rounded-full opacity-40 blur-3xl" style={{ background: "#7FB3D6" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-[1fr_1.15fr] md:gap-12 md:px-8 md:py-16">
        {/* النص */}
        <div className="text-center md:text-start">
          <h1 className="font-black text-white leading-[1.15] text-[34px] sm:text-[44px] md:text-[56px]" style={{ textWrap: "balance" as any }}>
            {ar ? <>أكل حقيقي.<br />سعرات محسوبة.</> : <>Real food.<br />Counted calories.</>}
          </h1>
          <p className="mt-3 text-lg md:text-xl font-semibold text-white">{ar ? "ويوصلك طازج كل يوم." : "Fresh at your door, every day."}</p>
          <p className="mx-auto md:mx-0 mt-4 max-w-md text-[15px] leading-7 text-white/90">
            {ar ? "وجبات تُطبخ صباح كل يوم بإشراف أخصائيي تغذية، مصمّمة حول هدفك لا حول منيو المطاعم."
                : "Meals cooked every morning under nutritionist supervision, built around your goal — not a restaurant menu."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            <button onClick={onPlans} className="h-12 rounded-full px-7 font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ background: NAVY }}>
              {ar ? "احصل على خطتك" : "Get your plan"}
            </button>
            <button onClick={onMenu} className="h-12 rounded-full border-2 bg-white px-7 font-bold transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ color: NAVY, borderColor: NAVY }}>
              {ar ? "استكشف القائمة" : "Explore the menu"}
            </button>
            {onSmartPlan && (
              <button onClick={onSmartPlan} className="h-12 rounded-full px-5 font-semibold text-white underline-offset-4 hover:underline">
                {ar ? "الخطة الذكية" : "Smart plan"}
              </button>
            )}
          </div>
        </div>

        {/* المسرح */}
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <div className="relative w-full" style={{ aspectRatio: "1.4" }}>
            <AnimatePresence initial={false} custom={shift}>
              {current && (
                <motion.div key={current.key} className="absolute inset-0"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: shift, rotate: promo ? 0 : 16 * dir, scale: 0.82 }}
                  animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -shift, rotate: promo ? 0 : -15 * dir, scale: 0.82 }}
                  transition={{ duration: reduced ? 0.2 : 1.1, ease: [0.16, 1, 0.3, 1] }}>
                  {current.link
                    ? <a href={current.link} target="_blank" rel="noopener noreferrer" aria-label={name} className="absolute inset-0 block">{art}</a>
                    : art}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* الإعلان كلامه داخل صورته؛ اسم الطبق فقط يُكتب تحته — كما في التطبيق */}
          <p className="mt-3 h-7 text-center text-lg font-bold text-white" aria-live="polite">{promo ? "" : name}</p>
          {slides.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button aria-label={ar ? "السابق" : "Previous"} onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-white transition hover:scale-105"><Prev className="h-5 w-5" style={{ color: NAVY }} /></button>
              <span className="min-w-[56px] text-center text-xs text-white tabular-nums">{index % slides.length + 1} / {slides.length}</span>
              <button aria-label={ar ? "التالي" : "Next"} onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full bg-white transition hover:scale-105"><Next className="h-5 w-5" style={{ color: NAVY }} /></button>
              {!reduced && (
                <button aria-label={paused ? (ar ? "تشغيل" : "Play") : (ar ? "إيقاف" : "Pause")} onClick={() => setPaused((p) => !p)} className="grid h-11 w-11 place-items-center rounded-full bg-white transition hover:scale-105">
                  {paused ? <Play className="h-4 w-4" style={{ color: NAVY }} /> : <Pause className="h-4 w-4" style={{ color: NAVY }} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
