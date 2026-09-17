import { subscriptionMessage, mealAllowance, translate as localize, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/**
 * الرئيسية — هيرو تحريري هادئ (كحلي + سماوي)، صف ثقة، الخطط، الأكثر طلباً، آراء، أسئلة، ختام.
 * كل البيانات من نفس استعلامات الموقع؛ لا منطق هنا سوى العرض.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, convex, SITE_URL } from "@/api";
import { restaurantPhone } from '@/contact';
import { colors, radii, softShadow } from "@/theme";
import { Btn, SectionTitle, T } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { HomeHero, type HeroSlide } from "@/components/HomeHero";
import { openWeb } from "@/openWeb";
import { SmartPlanEntry } from '@/components/SmartPlanEntry';
import { useCustomerSession } from '@/customerSession';
import { TodayHome } from '@/components/TodayHome';

const TRUST = [
  { icon: "leaf-outline", t: "مكونات طازجة", s: "تُطبخ صباح كل يوم" },
  { icon: "restaurant-outline", t: "شيفات محترفون", s: "وصفات معتمدة" },
  { icon: "bicycle-outline", t: "توصيل يومي", s: "مجاني لكل المشتركين" },
  { icon: "ribbon-outline", t: "جودة معتمدة", s: "بإشراف أخصائيي تغذية" },
];

const STORIES = [
  { n: "أحمد المالكي", r: "رياضي محترف", q: "أفضل خطة وجبات صحية جرّبتها. الطعام لذيذ، والتوصيل يصل دائمًا في الموعد." },
  { n: "فاطمة العبدالله", r: "مدربة لياقة", q: "خسرت 8 كيلو في شهرين بدون ما أحس إني على دايت! الوجبات متنوعة والشيف محترف فعلاً." },
  { n: "محمد الكواري", r: "رجل أعمال", q: "الوجبات جاهزة وصحية ومحسوبة، وتوفّر لي الكثير من الوقت وتمنحني طاقة أكبر." },
];

const FAQ = [
  { q: "كيف أبدأ الاشتراك؟", a: "اختر المدة والباقة وعدد الوجبات، ثم أكمل عبر PayLater على الموقع الرسمي أو تواصل مع الأخصائية." },
  { q: "هل التوصيل مجاني؟", a: "نعم، التوصيل مجاني تماماً لجميع المشتركين في كل أنحاء قطر." },
  { q: "هل أقدر أغير وجباتي؟", a: "بالتأكيد. تختار وجباتك من القائمة لكل يوم، وتطلب التعديلات وفق تفضيلاتك." },
];

function planImage(plan: any): string {
  const key = `${plan?.slug || ""} ${plan?.nameEn || ""} ${plan?.nameAr || ""}`.toLowerCase();
  if (key.includes("diet") || key.includes("tanshif") || key.includes("تنشيف")) return `${SITE_URL}/plan-tanshif-real.jpg`;
  if (key.includes("fitness") || key.includes("liyaqa") || key.includes("لياقة")) return `${SITE_URL}/plan-liyaqa-real.jpg`;
  if (key.includes("bulk") || key.includes("tadkhim") || key.includes("تضخيم")) return `${SITE_URL}/plan-tadkhim-real.jpg`;
  return `${SITE_URL}/custom-plan-meals.jpg`;
}

export default function Home() {
  useUILanguage();
  const {session,ready}=useCustomerSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const best = useQuery(api.publicMeals.bestSellers, { limit: 6 }) || [];
  const mealCatalog = useQuery(api.publicMeals.listMeals, {}) || [];
  const plans = useQuery(api.publicPlans.listByDuration, { duration: "week" }) || [];
  const settings = useQuery(api.restaurantSettings.get, {}) as any;
  // شرائح الهيرو من لوحة التحكم (إعلانات وأطباق) — تتغيّر بلا بناء جديد للتطبيق.
  // جلب اختياري لا اشتراك: تعذّر الإعلانات (خادم أقدم، انقطاع) لا يجوز أن يُسقط الصفحة الرئيسية.
  const [heroSlides, setHeroSlides] = useState<HeroSlide[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    convex.query(api.banners.listAppSlides, {}).then((rows: HeroSlide[]) => { if (alive) setHeroSlides(rows); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const phone = restaurantPhone(settings);
  const wa = (msg: string) => Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(localize(msg))}`);

  const [heroVisible, setHeroVisible] = useState(true);
  const heroImg = useMemo(() => best.find((m: any) => m.imageUrl)?.imageUrl || `${SITE_URL}/hero-banner.webp`, [best]);
  const [bestWidth, setBestWidth] = useState(Math.max(0, width - 40));
  const bestColumns = bestWidth >= 680 ? 3 : bestWidth >= 300 ? 2 : 1;
  const cardW = Math.max(0, (bestWidth - (bestColumns - 1) * 12) / bestColumns);
  const [storiesWidth, setStoriesWidth] = useState(Math.max(0, width - 40));
  const storyWidth = storiesWidth >= 900 ? (storiesWidth - 24) / 3 : storiesWidth;

  if(!ready)return <View style={{flex:1,backgroundColor:colors.bg}}/>;
  if(session)return <TodayHome/>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}
      scrollEventThrottle={100} onScroll={(event) => setHeroVisible(event.nativeEvent.contentOffset.y < 480)}>
      <HomeHero meals={best} fallback={heroImg} inset={insets.top} visible={heroVisible}
        liveSlides={heroSlides} onOpenLink={(url) => { void openWeb(url).catch(() => {}); }}
        onPlans={() => router.push("/(tabs)/plans")}
        onMenu={() => router.push("/(tabs)/menu")}
        onContact={() => wa("مرحباً 👋\nأرغب في معرفة المزيد عن خطط أدرينالين الصحية.")} />

      {/* ── صف الثقة ── */}
      <View style={styles.trustGrid}>
        {TRUST.map((x, i) => (
          <View key={x.t} style={[styles.trustCell, i % 2 === 1 && { borderStartWidth: 1 }, i >= 2 && { borderTopWidth: 1 }]}>
            <View style={styles.trustIcon}><Ionicons name={x.icon as any} size={18} color={colors.cyanDark} /></View>
            <View style={{ flex: 1 }}>
              <T w="black" style={{ fontSize: 13, color: colors.text }}>{x.t}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{x.s}</T>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.section,{gap:16}]}>
        <View style={{gap:8}}><SectionTitle title="حاسبة السعرات" sub="اعرف احتياجك اليومي من السعرات والماكروز حسب هدفك."/><Btn label="احسب احتياجك اليومي" variant="outline" onPress={()=>router.push('/calorie-calculator')}/></View>
        <SmartPlanEntry/>
      </View>

      {/* ── الخطط ── */}
      <View style={[styles.section, { backgroundColor: colors.bg2 }]}>
        <SectionTitle title="برامج مبنية حول هدفك" sub="اختر الباقة وعدد وجباتك، ونتكفّل بالباقي." action="كل الخطط" onAction={() => router.push("/(tabs)/plans")} />
        <View style={{ gap: 14 }}>
          {plans.slice(0, 3).map((plan: any, idx: number) => {
            const prices = (plan.options || []).map((o: any) => Number(o.priceQAR) || 0).filter((n: number) => n > 0);
            const min = prices.length ? Math.min(...prices) : 0;
            const popular = idx === 1;
            return (
              <View key={plan._id} style={[styles.planCard, softShadow, popular && { borderColor: colors.cyan }]}>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <View style={styles.planImg}><Image source={{ uri: planImage(plan) }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
                  <View style={{ flex: 1 }}>
                    {popular ? <View style={styles.popular}><T w="black" style={{ color: "#fff", fontSize: 10.5 }}>الأكثر طلباً</T></View> : null}
                    <T w="black" style={{ fontSize: 20, color: colors.navy2 }}>{localizedField(plan, 'name')}</T>
                    <T numberOfLines={2} style={{ fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>{localizedField(plan, 'description')}</T>
                  </View>
                </View>
                {min > 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                    <T w="bold" style={{ fontSize: 12, color: colors.muted }}>من</T>
                    <T w="black" style={{ fontSize: 30, color: colors.navy2, fontVariant: ["tabular-nums"] }}>{min}</T>
                    <T w="bold" style={{ fontSize: 13, color: colors.cyanDark }}>ر.ق / أسبوع</T>
                  </View>
                ) : null}
                <View style={{ gap: 8, marginTop: 12 }}>
                  {(plan.options || []).slice(0, 2).map((o: any, oi: number) => (
                    <Pressable key={oi} onPress={() => wa(subscriptionMessage(localizedField(plan), 'أسبوع', o))} style={styles.optRow}>
                      <T w="bold" style={{ fontSize: 13.5, color: colors.navy2 }}>{mealAllowance(o.mealsCount, o.snacksCount)}</T>
                      <T w="black" style={{ fontSize: 13.5, color: colors.cyanDark, fontVariant: ["tabular-nums"] }}>{Number(o.priceQAR) > 0 ? `${o.priceQAR} ر.ق` : "اشترك"}</T>
                    </Pressable>
                  ))}
                  <T style={{ fontSize: 10.5, color: "#8AA6BD" }}>اضغط على الباقة للاشتراك عبر واتساب</T>
                </View>
                <Btn label="استكشف الخطة" variant="outline" onPress={() => router.push("/(tabs)/plans")} style={{ marginTop: 12, height: 46 }} />
              </View>
            );
          })}
        </View>
      </View>

      {/* ── الأكثر طلباً ── */}
      {best.length ? (
        <View style={styles.section}>
          <SectionTitle title="الأكثر طلباً" sub="ما يختاره مشتركونا أكثر" action="اختيار وجبات اشتراكي" onAction={() => router.push("/(tabs)/menu")} />
          <View onLayout={(event) => setBestWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {best.map((m: any, i: number) => (
              <MealCard key={m.id || m._id} meal={{ ...m, ...mealCatalog.find((meal: { _id: string }) => String(meal._id) === String(m.id || m._id)), _id: m.id || m._id }} compact width={cardW} rank={i < 3 ? i + 1 : undefined} onPress={() => router.push({ pathname: "/meal/[id]", params: { id: String(m.id || m._id) } })} />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── آراء ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <SectionTitle title="قصص حقيقية. نتائج حقيقية." sub="تجارب مشتركين مع وجبات أدرينالين" />
        <View onLayout={(event) => setStoriesWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {STORIES.map((s) => (
            <View key={s.n} style={[styles.story, { width: storyWidth }]}>
              <View style={{ flexDirection: "row", gap: 2 }}>{[0, 1, 2, 3, 4].map((i) => <Ionicons key={i} name="star" size={14} color={colors.amber} />)}</View>
              <T w="semibold" style={{ fontSize: 14.5, lineHeight: 24, color: colors.navy2, flex: 1 }}>«{s.q}»</T>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                <View style={styles.avatar}><T w="black" style={{ color: colors.cyanDark }}>{s.n.charAt(0)}</T></View>
                <View style={{ flex: 1 }}><T w="black" style={{ fontSize: 13 }}>{s.n}</T><T style={{ fontSize: 11.5, color: colors.muted }}>{s.r}</T></View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── أسئلة ── */}
      <View style={styles.section}>
        <SectionTitle title="الأسئلة الشائعة" />
        <View style={{ gap: 10 }}>{FAQ.map((f) => <FaqItem key={f.q} {...f} />)}</View>
      </View>

      {/* ── ختام ── */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <View style={styles.finalCta}>
          <T w="black" style={{ fontSize: 24, color: "#fff", lineHeight: 34 }}>ابدأ رحلتك الصحية اليوم</T>
          <T style={{ color: "rgba(255,255,255,0.7)", fontSize: 13.5, marginTop: 6, lineHeight: 21 }}>انضم لأكثر من ٢٠٠ مشترك يستلمون وجباتهم طازجة كل يوم.</T>
          <View style={{ gap: 10, marginTop: 18 }}>
            <Btn label="تواصل واتساب" variant="white" onPress={() => wa("مرحباً 👋\nأرغب في معرفة المزيد عن خطط أدرينالين الصحية.")} style={{ height: 46 }} />
            <Btn label="تصفّح الخطط" variant="outlineLight" onPress={() => router.push("/(tabs)/plans")} style={{ height: 46 }} />
          </View>
        </View>
        <T style={{ textAlign: "center", color: colors.muted, fontSize: 11, marginTop: 18 }}>© ADRENALINE HEALTHY FOOD · قطر</T>
      </View>
    </ScrollView>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  useUILanguage();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={[styles.faq, open && { borderColor: colors.cyan }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <T w="black" style={{ flex: 1, fontSize: 14.5, color: colors.navy2 }}>{q}</T>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={open ? colors.cyanDark : "#8AA6BD"} />
      </View>
      {open ? <T style={{ fontSize: 13.5, lineHeight: 22, color: "#3D4F5C", marginTop: 8 }}>{a}</T> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.navy, paddingHorizontal: 20, paddingBottom: 26, overflow: "hidden" },
  glow: { position: "absolute", top: -120, end: -100, width: 380, height: 380, borderRadius: 190, backgroundColor: "rgba(60,196,240,0.16)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  eyebrow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 12, height: 30, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", marginBottom: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cyan },
  eyebrowT: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  h1: { fontSize: 30, lineHeight: 42, color: "#fff" },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: 14.5, lineHeight: 24, marginTop: 14, maxWidth: 520 },
  ctaRow: { gap: 10, marginTop: 22 },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" },
  trustDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  trustT: { fontSize: 12.5, color: "rgba(255,255,255,0.55)" },
  heroImgWrap: { marginTop: 22, aspectRatio: 4 / 5, borderRadius: 28, overflow: "hidden", backgroundColor: "#0F2A44", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  heroShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140, backgroundColor: "rgba(7,19,31,0.28)" },
  floatCard: { position: "absolute", bottom: 14, start: 14, end: 14, backgroundColor: "#fff", borderRadius: 18, padding: 10, flexDirection: "row", gap: 12, alignItems: "center" },
  floatThumb: { width: 60, height: 60, borderRadius: 12, overflow: "hidden", backgroundColor: "#EAF3FB" },
  floatBadge: { alignSelf: "flex-start", backgroundColor: colors.cyan, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  trustGrid: { backgroundColor: "#fff", flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderBottomColor: colors.line },
  trustCell: { width: "50%", flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 14, paddingVertical: 16, borderColor: colors.line },
  trustIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EAF3FB", alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: 20, paddingVertical: 28 },
  planCard: { backgroundColor: "#fff", borderRadius: radii.card, padding: 18, borderWidth: 1.5, borderColor: "#fff" },
  popular: { alignSelf: "flex-start", backgroundColor: colors.cyan, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginBottom: 4 },
  planImg: { width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: "#EAF3FB" },
  optRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F4F8FB", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  story: { backgroundColor: "#F4F8FB", borderRadius: radii.card, padding: 18, gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cyanSoft, alignItems: "center", justifyContent: "center" },
  faq: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 14 },
  finalCta: { backgroundColor: colors.navy, borderRadius: 28, padding: 22 },
});
