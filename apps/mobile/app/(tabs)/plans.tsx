/** الخطط — كل الباقات (أسبوع/أسبوعان/شهر) ببطاقة ناعمة؛ الاشتراك عبر واتساب كما في الموقع. اختيار الوجبات من التطبيق لاحقاً. */
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors, radii, softShadow } from "@/theme";
import { Chip, T } from "@/components/ui";

const DURS = [{ id: "week", l: "أسبوع" }, { id: "two_weeks", l: "أسبوعان" }, { id: "month", l: "شهر" }] as const;

export default function Plans() {
  const insets = useSafeAreaInsets();
  const [dur, setDur] = useState<(typeof DURS)[number]["id"]>("week");
  const plans = (useQuery(api.publicPlans.listByDuration, { duration: dur }) || []) as any[];
  const settings = useQuery(api.restaurantSettings.get, {}) as any;
  const phone = String(settings?.phone || "+97412345678").replace(/\D/g, "");
  const wa = (msg: string) => Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  const durLabel = DURS.find((d) => d.id === dur)!.l;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg2 }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <T w="black" style={styles.title}>ابنِ خطتك</T>
        <T style={styles.sub}>اختر المدة ثم الباقة، ونتواصل معك لتثبيت اشتراكك.</T>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {DURS.map((d) => <Chip key={d.id} label={d.l} active={dur === d.id} onPress={() => setDur(d.id)} />)}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
        {plans.map((plan: any) => {
          const opts: any[] = plan.options || [];
          const prices = opts.map((o) => Number(o.priceQAR) || 0).filter((n) => n > 0);
          const min = prices.length ? Math.min(...prices) : 0;
          return (
            <View key={plan._id} style={[styles.card, softShadow]}>
              <T w="black" style={{ fontSize: 20, color: colors.navy2 }}>{plan.nameAr}</T>
              {plan.descriptionAr ? <T style={{ fontSize: 12.5, color: colors.muted, lineHeight: 19, marginTop: 2 }}>{plan.descriptionAr}</T> : null}
              {min > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 12 }}>
                  <T w="bold" style={{ fontSize: 12, color: colors.muted }}>من</T>
                  <T w="black" style={{ fontSize: 30, color: colors.navy2, fontVariant: ["tabular-nums"] }}>{min}</T>
                  <T w="bold" style={{ fontSize: 13, color: colors.cyanDark }}>ر.ق / {durLabel}</T>
                </View>
              ) : null}
              <View style={{ gap: 8, marginTop: 12 }}>
                {opts.map((o, oi) => (
                  <Pressable key={oi} style={styles.opt}
                    onPress={() => wa(`مرحباً 👋\nأرغب في الاشتراك في خطة *${plan.nameAr}* (${durLabel})\n\nالباقة: ${o.mealsCount} وجبات + ${o.snacksCount} سناك\n\nمن فضلك أرسلوا لي تفاصيل الاشتراك.`)}>
                    <T w="bold" style={{ fontSize: 13.5, color: colors.navy2 }}>{o.mealsCount} وجبات + {o.snacksCount} سناك</T>
                    <T w="black" style={{ fontSize: 13.5, color: colors.cyanDark, fontVariant: ["tabular-nums"] }}>{Number(o.priceQAR) > 0 ? `${o.priceQAR} ر.ق` : "اشترك"}</T>
                  </Pressable>
                ))}
                <T style={{ fontSize: 10.5, color: "#8AA6BD" }}>اضغط على الباقة للاشتراك عبر واتساب</T>
              </View>
            </View>
          );
        })}
        {!plans.length ? <T style={{ textAlign: "center", color: colors.muted, padding: 30 }}>جارٍ التحميل…</T> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontSize: 30, color: colors.navy2, lineHeight: 40 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: radii.card, padding: 18 },
  opt: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F4F8FB", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
});
