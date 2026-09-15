import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** القائمة — رأس نصّي بعدد الأطباق، بحث، كبسولات تصنيف، شبكة عمودين من بطاقة الطبق. تصفّح فقط (الطلب لاحقاً). */
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { TextInput } from '@/components/LocalizedTextInput';
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api,convex } from "@/api";
import { colors, fonts } from "@/theme";
import { Btn, Chip, T } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { SubscriberPhoneGate } from '@/components/SubscriberPhoneGate';
import { SubscriberMealPlanner } from '@/components/SubscriberMealPlanner';
import { isSnackCategory } from "@/rules";
import { useCustomerSession } from '@/customerSession';

const CATS = [
  { id: "all", l: "الكل" }, { id: "breakfast", l: "الإفطار" }, { id: "lunch", l: "الغداء" },
  { id: "dinner", l: "العشاء" }, { id: "snack", l: "سناكس" },
];

export default function Menu() {
  useUILanguage();
  const router = useRouter();
  const {session}=useCustomerSession();
  const [profile,setProfile]=useState<any>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [cat, setCat] = useState("all");
  const [subscriber, setSubscriber] = useState<{ id: string; phone: string; name?: string } | null>(null);
  const [method, setMethod] = useState<'manual' | 'smart' | null>(null);
  useEffect(()=>{
    let alive=true;setProfile(null);setSubscriber(null);setMethod(null);
    if(session)void convex.query(api.customerAuth.getProfile,{accountId:session.accountId,sessionToken:session.token})
      .then(p=>{if(alive)setProfile(p);}).catch(()=>{if(alive)setProfile(null);});
    return()=>{alive=false;};
  },[session?.accountId,session?.token]);
  useEffect(()=>{
    if(profile?.subscription)setSubscriber({id:profile.subscription.id,phone:profile.subscription.phone||profile.account.phone,name:profile.subscription.fullName||profile.account.fullName});
  },[profile?.subscription?.id]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(q.trim()), 250); return () => clearTimeout(timer); }, [q]);
  const result = useQuery(api.publicMeals.listMeals, { search: search || undefined }) as any[] | undefined;
  const all = result || [];
  const loading = result === undefined || search !== q.trim();

  const meals = useMemo(() => all.filter((m) => {
    if (cat === "all") return true;
    if (cat === "snack") return isSnackCategory(m.category);
    return String(m.category || "").toLowerCase() === cat;
  }), [all, cat]);

  const gap = 12, pad = 16;
  const listWidth = Math.min(width, 1100);
  const columns = listWidth < 350 ? 1 : listWidth >= 900 ? 4 : listWidth >= 650 ? 3 : 2;
  const cardW = (listWidth - pad * 2 - gap * (columns - 1)) / columns;

  if (subscriber && method) return <SubscriberMealPlanner key={subscriber.id} subscriberId={subscriber.id} phone={subscriber.phone} initialMode={method} onExit={() => setMethod(null)}/>;
  if (subscriber) return <ScrollView style={{flex:1,backgroundColor:colors.bg}} contentContainerStyle={{padding:20,paddingTop:insets.top+20,paddingBottom:insets.bottom+24,gap:20,width:'100%',maxWidth:650,alignSelf:'center'}}>
    <T accessibilityRole="header" w="black" style={styles.title}>كيف تختار وجباتك؟</T>
    <T style={{color:colors.muted2,lineHeight:24}}>{subscriber.name?`اشتراك ${subscriber.name}`:'تم تحديد اشتراكك'}. اختر الطريقة المناسبة لك.</T>
    <View style={{padding:20,gap:12,backgroundColor:colors.card,borderRadius:16}}>
      <T w="black" style={{fontSize:20,color:colors.navy2}}>اختيار يدوي</T>
      <T style={{color:colors.muted2,lineHeight:24}}>اختر الوجبات والسناكات لكل يوم، حسب اشتراكك وجدول المطبخ، ثم راجع خطتك قبل الإرسال.</T>
      <Btn label="اختار وجباتي يدويًا" onPress={()=>setMethod('manual')}/>
    </View>
    <View style={{padding:20,gap:12,backgroundColor:colors.cyanSoft,borderRadius:16}}>
      <T w="black" style={{fontSize:20,color:colors.navy2}}>خطة ذكية</T>
      <T style={{color:colors.navy2,lineHeight:24}}>نقترح الوجبات المتاحة لاشتراكك، وتعدّلها وتراجعها هنا قبل إرسالها للأخصائية.</T>
      <Btn label="اقترح لي وجباتي" onPress={()=>setMethod('smart')}/>
    </View>
    <Btn label="تغيير المشترك أو تصفّح القائمة" variant="outline" onPress={()=>{setMethod(null);setSubscriber(null);}}/>
  </ScrollView>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        key={columns}
        style={{ width: '100%', maxWidth: 1100, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        data={meals}
        keyExtractor={(m) => String(m._id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap, paddingHorizontal: pad } : undefined}
        contentContainerStyle={{ gap, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 14 }}>
            <View style={styles.head}>
              <T w="black" style={styles.title}>اختيار وجبات اشتراكي</T>
              <T w="bold" style={styles.count}>{loading ? 'نجهّز لك القائمة…' : `${meals.length} وجبة${q.trim() ? ' تطابق بحثك' : ' متاحة للتصفح'}`}</T>
              <T style={styles.sub}>محسوبة السعرات بإشراف أخصائيي تغذية، وتُطبخ صباح كل يوم.</T>
              <SubscriberPhoneGate onSelect={(customer, phone) => {setMethod(null);setSubscriber({ id: customer._id, phone, name:customer.fullName });}}/>
            </View>
            <View style={styles.tools}>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={colors.muted} />
                <TextInput accessibilityLabel={localize(String("البحث باسم الوجبة بالعربي أو الإنجليزي"))} value={q} onChangeText={setQ} placeholder={localize(String("اسم الوجبة بالعربي أو الإنجليزي"))} placeholderTextColor={colors.muted2} style={styles.input} returnKeyType="search" />
              </View>
              <FlatList horizontal data={CATS} keyExtractor={(c) => c.id} showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: pad, paddingBottom: 12 }}
                renderItem={({ item }) => <Chip label={item.l} active={cat === item.id} onPress={() => setCat(item.id)} />} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns === 1 ? {paddingHorizontal:pad} : undefined}><MealCard meal={item} width={cardW} onPress={() => router.push({ pathname: "/meal/[id]", params: { id: String(item._id) } })} /></View>
        )}
        ListEmptyComponent={loading ? <View accessibilityLabel={localize(String("جارٍ تحميل الوجبات"))} style={{padding:16,gap:12}}>{[0,1,2].map(i=><View key={i} style={{height:120,borderRadius:16,backgroundColor:colors.line}}/>)}</View> : <View style={{padding:32,gap:12,alignItems:'center'}}><Ionicons name="search-outline" size={32} color={colors.muted2}/><T w="bold">لا توجد وجبات مطابقة</T><T style={{color:colors.muted2,textAlign:'center'}}>جرّب اسمًا آخر أو اعرض كل التصنيفات.</T><Btn label="عرض كل الوجبات" variant="outline" onPress={()=>{setQ('');setCat('all');}}/></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, alignItems: "center" },
  title: { fontSize: 30, color: colors.navy2, lineHeight: 40 },
  count: { fontSize: 14, color: colors.cyanDark, marginTop: 6, textAlign: "center" },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 4, textAlign: "center" },
  tools: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  search: { marginHorizontal: 16, marginBottom: 10, height: 44, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: "right", paddingVertical: 0 },
});
