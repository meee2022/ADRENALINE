import { translate as localize, contentLanguage as uiLanguage, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, convex } from '@/api';
import { colors, fonts } from '@/theme';
import { customerProgram, isSnackCategory, programCalFactor, scaledNutrition, slotToDate, mealAvailableOn, countPicks } from '@/rules';
import { Pick, SelectionMeal, selectionState, selectionReady, pickVerdict, picksAt, replacePick, selectableMeal, dayNavigationAllowed } from '@/subscriberSelection';
import { Btn, Chip, T } from './ui';
import { MealCard } from './MealCard';
import { PublicSubscriber } from './SubscriberPhoneGate';
import { mergeSmartSuggestions } from '@/smartSelection';
import { PlanOverview } from './PlanOverview';
import { loadDraft, saveDraft, restorePicks, makeDraft, discardDraft } from '@/draftStorage';

const DAYS: Record<string, string> = { saturday: 'السبت', sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس' };
const BLOCKS: Record<string, string> = {
  outsideSubscription: 'هذا اليوم خارج الأيام المتاحة في اشتراكك.', previousDayIncomplete: 'أكمل وجبات اليوم السابق أولًا.',
  unavailable: 'هذه الوجبة غير متاحة لهذا اليوم وأسبوع الطبخ.', noMealPlan: 'عدد الوجبات غير محدد. تواصل مع الأخصائية لضبط اشتراكك.',
  mealsFull: 'اكتمل عدد الوجبات الرئيسية لهذا اليوم. احذف وجبة لتختار بدلًا منها.', snacksFull: 'وصلت إلى حد السناكات في اشتراكك لهذا اليوم.',
};

/** Native manual journey; no direct writes to dailyPlans or kitchen records. */
export function SubscriberMealPlanner({ subscriberId, phone, onExit, initialMode = 'manual' }: { subscriberId: string; phone: string; onExit: () => void; initialMode?: 'manual' | 'smart' }) {
  const { t } = useUILanguage();
  const customers = useQuery(api.customers.findPublicByPhone, { phone, restaurantKey: 'ADRENALINE' }) as PublicSubscriber[] | undefined;
  const customer = customers?.find(c => c._id === subscriberId);
  const rotation = useQuery(api.restaurantSettings.rotationWeekAt, customer?.startDate ? { targetDate: customer.startDate } : 'skip') as { rotationWeek?: number } | undefined;
  const settings = useQuery(api.restaurantSettings.get, {}) as any;
  const catalog = useQuery(api.publicMeals.listMeals, {}) as SelectionMeal[] | undefined;
  const [picks, setPicks] = useState<Pick[]>([]);
  const draftId=customer?subscriberId+'.'+customer.startDate+'.'+customer.endDate:'';
  const [draftKey,setDraftKey]=useState('');
  const draftReady=!!draftId&&draftKey===draftId;
  const [saveState,setSaveState]=useState('جارٍ استعادة المسودة…');
  const [selected, setSelected] = useState(0);
  const [kind, setKind] = useState<'main' | 'snack'>('main');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [generating, setGenerating] = useState(false);
  const generationLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [, refreshClock] = useState(0);
  useEffect(() => {
    const refresh = () => refreshClock(n => n + 1);
    const timer = setInterval(refresh, 60_000);
    const listener = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  const [orderNumber, setOrderNumber] = useState('');
  const [confirmation, setConfirmation] = useState<{ text: string; accept: () => void } | null>(null);
  const submitLock = useRef(false);
  // Preserve both key AND payload after an uncertain network response; retry cannot duplicate the order.
  const attempt = useRef<any>(null);
  useEffect(()=>{
    if(!catalog||!draftId||draftReady)return;
    let alive=true;
    loadDraft(draftId).then(d=>{
      if(!alive)return;
      setPicks(d?restorePicks(d,catalog):[]);attempt.current=d?.attempt||null;setOrderNumber(d?.submitted||'');
      setSaveState(d?'تمت استعادة المسودة؛ تُراجع الاختيارات مع الجدول الحالي.':'تُحفظ اختياراتك على هذا الجهاز.');
      setDraftKey(draftId);
    }).catch(async()=>{
      await discardDraft(draftId).catch(()=>{});
      if(!alive)return;
      setPicks([]);attempt.current=null;setOrderNumber('');
      setSaveState('تعذّرت قراءة مسودة قديمة على هذا الجهاز فبدأنا اختياراً جديداً.');
      setDraftKey(draftId);
    });
    return()=>{alive=false;};
  },[catalog,draftId,draftReady]);
  useEffect(()=>{
    if(!draftReady)return;
    let alive=true;
    setSaveState('جارٍ حفظ الاختيارات…');
    void saveDraft(makeDraft(draftId,picks,attempt.current,orderNumber||undefined))
      .then(()=>{if(alive)setSaveState('تم الحفظ على هذا الجهاز');})
      .catch(()=>{if(alive)setSaveState('تعذّر الحفظ على الجهاز. لا تغلق التطبيق قبل إعادة المحاولة.');});
    return()=>{alive=false;};
  },[picks,draftReady,draftId,orderNumber]);
  const list = useRef<FlatList<SelectionMeal>>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 1100), columns = w < 350 ? 1 : w >= 900 ? 4 : w >= 650 ? 3 : 2;
  const cardWidth = (w - 32 - (columns - 1) * 12) / columns;
  const rotationWeek = Number(rotation?.rotationWeek);
  const freshPicks = useMemo(() => picks.map(p => ({ ...p, meal: catalog?.find(m => m._id === p.meal._id) || p.meal })), [picks, catalog]);
  const state = selectionState(customer || { _id: subscriberId }, rotationWeek, freshPicks);
  const active = state.slots[Math.min(selected, Math.max(0, state.slots.length - 1))];
  const today = active ? picksAt(freshPicks, active.week, active.day) : [];
  const counts = countPicks(today.map(p => p.meal));
  const ready = !!customer && !!catalog && !!rotation && selectionReady(customer, rotationWeek, freshPicks)
    && freshPicks.every(p => catalog.some(m => m._id === p.meal._id));
  const factor = programCalFactor(customerProgram(customer), settings?.programPortions);
  const unavailablePicks=freshPicks.filter(p=>!catalog?.some(m=>m._id===p.meal._id&&selectableMeal(m,p.week,p.day)));
  const meals = (catalog || []).filter(m => active && selectableMeal(m, active.week, active.day)
    && (kind === 'snack' ? isSnackCategory(m.category) : !isSnackCategory(m.category))
    && `${m.nameAr} ${m.nameEn || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const frozen = !draftReady || busy || generating || generationLock.current || !!attempt.current;
  const latest = useRef({customer, catalog, rotationWeek, freshPicks});
  latest.current = {customer, catalog, rotationWeek, freshPicks};
  const previousDay = useRef<{key:string;complete:boolean}|null>(null);
  const activeKey = active ? `${active.week}:${active.day}` : '';
  const activeComplete = !!state.completed[selected];
  useEffect(() => {
    const previous = previousDay.current;
    previousDay.current = {key:activeKey,complete:activeComplete};
    if(mode!=='manual'||frozen||review||confirmation||!previous||previous.key!==activeKey||previous.complete||!activeComplete) return;
    const timer=setTimeout(()=>{
      const current=latest.current;
      if(!current.customer) return;
      const next=selectionState(current.customer,current.rotationWeek,current.freshPicks);
      if(next.firstIncomplete>=0){
        setSelected(next.firstIncomplete);setKind('main');setSearch('');
        setMessage(`اكتملت اختيارات اليوم. انتقلنا إلى ${DAYS[next.slots[next.firstIncomplete].day]}.`);
        list.current?.scrollToOffset({offset:0,animated:true});
      } else {setMessage('اكتملت أيام اشتراكك. راجع الوجبات بالصور قبل الإرسال.');setReview(true);}
    },900);
    return ()=>clearTimeout(timer);
  },[activeKey,activeComplete,mode,frozen,review,confirmation]);
  const editDay = (index:number) => {
    if(frozen)return;
    if(!dayNavigationAllowed(index,state.firstIncomplete,state.slots.length)){setMessage(BLOCKS.previousDayIncomplete);return;}
    setSelected(index);setMode('manual');setReview(false);setKind('main');setSearch('');setMessage('');
    list.current?.scrollToOffset({offset:0,animated:false});
  };
  const removePick = (index:number) => {
    if(frozen)return;
    setPicks(previous=>previous.filter((_,i)=>i!==index));
  };
  const swapPick = (index:number,expected:Pick,meal:SelectionMeal,approved:boolean) => {
    if(frozen||generationLock.current||submitLock.current||attempt.current)return;
    const current=latest.current;
    const canonical=current.catalog?.find(m=>m._id===meal._id);
    if(!current.customer||!canonical)return;
    setPicks(previous=>replacePick(current.customer!,current.rotationWeek,previous,index,expected,canonical,approved));
  };
  const generate = async () => {
    if (frozen || !customer || !catalog || state.limits.noMealPlan || state.firstIncomplete < 0) return;
    const first = state.slots[state.firstIncomplete];
    const startDate = slotToDate(customer.startDate, rotationWeek, first.week, first.day);
    if (!startDate || !customer.endDate) return;
    generationLock.current = true; setGenerating(true); setMessage('جارٍ اقتراح الوجبات؛ قد يستغرق ذلك بضع دقائق. لن تُرسل الخطة تلقائيًا.');
    try {
      const result = await convex.action(api.ai.generateWeeklyPlan, {
        customerId: subscriberId as any, phone, restaurantKey: 'ADRENALINE',
        startDate, endDate: customer.endDate, startRotationWeek: first.week,
      });
      if (!mounted.current) return;
      const current = latest.current;
      if (!current.customer || !current.catalog || JSON.stringify(current.customer) !== JSON.stringify(customer) || current.rotationWeek !== rotationWeek) {
        setMessage('تغيّرت بيانات الاشتراك أثناء الاقتراح. راجع البيانات الجديدة قبل المحاولة مجددًا.'); return;
      }
      const next = mergeSmartSuggestions(current.customer, current.rotationWeek, current.freshPicks, current.catalog, result.days || []);
      const added = next.length - current.freshPicks.length;
      setPicks(next);
      const remaining = selectionState(current.customer, rotationWeek, next);
      setSelected(Math.max(0, remaining.firstIncomplete));
      setMessage(added ? `أُضيف ${added} صنفًا للمسودة مع الاحتفاظ باختياراتك.${remaining.shortfall.incompleteDays ? ' توجد أيام ناقصة؛ أكملها يدويًا.' : ' راجع الوجبات ثم أكّد الإرسال.'}` : 'لم نجد اقتراحات إضافية مطابقة للقيود. اختياراتك لم تتغيّر؛ يمكنك الإكمال يدويًا.');
    } catch (error) {
      if (mounted.current) setMessage(error instanceof ConvexError && typeof error.data === 'string' ? error.data : 'تعذّر اقتراح الخطة. اختياراتك لم تتغيّر؛ حاول لاحقًا أو أكمل يدويًا.');
    } finally { generationLock.current = false; if (mounted.current) setGenerating(false); }
  };
  const add = (meal: SelectionMeal, approved = false) => {
    const {customer,catalog,rotationWeek,freshPicks}=latest.current;
    if (!customer || !active || frozen || generationLock.current || submitLock.current || attempt.current) return;
    const canonical=catalog?.find(m=>m._id===meal._id);
    if(!canonical){setMessage('هذه الوجبة لم تعد متاحة. اختر وجبة أخرى.');return;}
    meal=canonical;
    const verdict = pickVerdict(customer, rotationWeek, freshPicks, active.week, active.day, meal);
    if (verdict.block) { setMessage(BLOCKS[verdict.block]); return; }
    const warnings = [verdict.secondBreakfast && 'هذه وجبة فطور ثانية لنفس اليوم وتُحسب من وجباتك الرئيسية.',
      verdict.restriction && `هذه الوجبة تطابق ممنوعاتك أو حساسيتك: ${verdict.restriction}. اختيارها على مسؤوليتك وسيظهر التنبيه للأخصائية.`,
      verdict.duplicate && 'اخترت نفس الوجبة بالفعل؛ إضافتها تعني استلامها مكرّرة في نفس اليوم.'].filter(Boolean);
    if (warnings.length && !approved) { setConfirmation({ text: warnings.join('\n\n'), accept: () => add(meal, true) }); return; }
    setPicks(previous => {
      // Recheck against queued taps too; a rapid double tap cannot exceed a limit.
      const latest = pickVerdict(customer, rotationWeek, previous, active.week, active.day, meal);
      if (latest.block || (!approved && (latest.duplicate || latest.secondBreakfast || latest.restriction))) return previous;
      return [...previous, { meal, week: active.week, day: active.day }];
    });
    setMessage(`أُضيفت ${localizedField(meal)} إلى ${DAYS[active.day]}.`);
    if (kind === 'main' && counts.meals + 1 >= state.limits.mealsPerDay && state.limits.snacksPerDay > counts.snacks) setKind('snack');
  };
  const remove = (meal: SelectionMeal) => {
    if (!active || frozen) return;
    setPicks(previous => { const index = previous.map(p => p.meal._id === meal._id && p.week === active.week && p.day === active.day).lastIndexOf(true); return previous.filter((_, i) => i !== index); });
    setMessage('أُزيلت نسخة واحدة من الوجبة.');
  };
  const exit = () => {
    if (busy || generationLock.current) return;
    if (picks.length) setConfirmation({ text: attempt.current ? 'لم نتأكد من نتيجة الإرسال. أعد المحاولة بنفس الطلب قبل الخروج لتجنّب إرسال طلب آخر بالخطأ.' : 'الاختيارات لم تُرسل بعد. ستبقى المسودة المحفوظة على هذا الجهاز لتكملها لاحقًا.', accept: attempt.current ? () => { setReview(true); } : onExit });
    else onExit();
  };
  const submit = async () => {
    if (submitLock.current || generationLock.current || !customer) return;
    if (!ready && !attempt.current) {
      setMessage(t('يجب إكمال جميع وجبات وسناكات الخطة لكل أيام الاشتراك قبل الإرسال.', 'Complete all meals and snacks for every subscription day before submitting.'));
      setReview(true);
      return;
    }
    submitLock.current = true; setBusy(true); setMessage('');
    if (!attempt.current) attempt.current = {
      restaurantKey: 'ADRENALINE', customerName: customer.fullName || '', customerPhone: phone, customerId: subscriberId,
      preferredStartDate: customer.startDate,
      items: freshPicks.map(p => ({ mealId: p.meal._id, week: p.week, day: p.day })),
      idempotencyKey: `expo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    try {
      // Persist the exact retry payload BEFORE the network request.
      await saveDraft(makeDraft(draftId,picks,attempt.current));
      const result = await convex.mutation(api.customerOrders.create, attempt.current);
      await saveDraft(makeDraft(draftId,[],undefined,String(result.orderNumber)));
      setOrderNumber(String(result.orderNumber)); setPicks([]); attempt.current = null; setReview(false);
    } catch (error: any) {
      // Known validation errors did not commit; allow correction. Unknown/network failures keep the exact retry.
      const raw = String(error?.data || error?.message || '');
      if (error instanceof ConvexError || raw.includes('ORDER_VALIDATION:')) {
        attempt.current = null;
        void saveDraft(makeDraft(draftId,picks)).catch(()=>setSaveState('تعذّر حفظ التصحيح؛ أعد المحاولة قبل الإغلاق.'));
        setMessage('لم يُرسل الطلب: بيانات الاشتراك أو جدولة الوجبات لا تطابق الشروط الحالية. راجع الأيام والوجبات أو تواصل مع الأخصائية.');
      } else setMessage('تعذّر تأكيد نتيجة الإرسال. اختياراتك محفوظة هنا؛ أعد المحاولة بنفس الطلب، ولا تنشئ طلبًا جديدًا.');
    } finally { submitLock.current = false; setBusy(false); }
  };
  if (orderNumber) return <View style={[s.status, { paddingTop: insets.top + 32 }]}><Ionicons name="checkmark-circle-outline" size={52} color={colors.cyanDark}/><T w="black" style={s.title}>تم إرسال خطتك</T><T>رقم الطلب: {orderNumber}</T><T style={s.copy}>وصلت للأخصائية للمراجعة، بنفس مسار الموقع الرسمي.</T><Btn label="العودة إلى القائمة" onPress={onExit}/>{/* كانت الشاشة تُقفل على «تم الإرسال» لنفس الفترة للأبد، حتى لو رفضت الأخصائية الطلب. */}<Btn label="بدء اختيار جديد لهذه الفترة" variant="outline" onPress={()=>{setOrderNumber('');setPicks([]);attempt.current=null;}}/></View>;
  if (!customers || (customer && (!catalog || !settings || (customer.startDate && !rotation)))) return <View style={s.status}><T>جارٍ تحميل اشتراكك وجدول المطبخ…</T><Btn label="رجوع" variant="outline" onPress={onExit}/></View>;
  if (!customer) return <View style={s.status}><T>لم يعد هذا الاشتراك مرتبطًا بالرقم. تحقق من رقم الهاتف مجددًا.</T><Btn label="العودة" onPress={onExit}/></View>;
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <FlatList ref={list} key={columns} style={s.list} data={mode==='manual'?meals:[]} numColumns={columns} keyExtractor={m => m._id}
      keyboardShouldPersistTaps="handled" columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} contentContainerStyle={{ padding: 16, gap: 12, paddingTop: insets.top + 16 }}
      ListHeaderComponent={<View style={{ gap: 10 }}>
        <View style={s.heading}><T w="black" style={s.title}>وجبات اشتراكك</T><Pressable accessibilityRole="button" onPress={exit} disabled={busy||generating} style={s.touch}><T style={s.link}>رجوع</T></Pressable></View>
        <View style={{gap:4}}><T w="bold" style={{fontSize:18,color:colors.navy2}}>{customer.fullName}</T><T style={s.copy}>فترة الاشتراك: {customer.startDate} — {customer.endDate}</T></View>
        <View style={s.heading}><Chip label="اختيار يدوي" active={mode==='manual'} onPress={()=>!frozen&&setMode('manual')}/><Chip label="مساعدة ذكية" active={mode==='smart'} onPress={()=>!frozen&&setMode('smart')}/></View>
        {mode==='smart'&&<View style={[s.summary,{padding:16,gap:12}]}>
          <T w="black" style={{fontSize:20,color:colors.navy2}}>وجبات تناسب اشتراكك</T>
          <T style={s.copy}>اقتراح للأيام المتبقية حسب اشتراكك وجدول المطبخ. نحافظ على اختياراتك الحالية، ويمكنك تعديل المقترحات يدويًا قبل المراجعة والإرسال.</T>
          <Btn label={generating?'جارٍ اقتراح الوجبات…':'اقتراح الوجبات المتبقية'} disabled={frozen||state.limits.noMealPlan||state.firstIncomplete<0} onPress={()=>void generate()}/>
        </View>}
        <View style={s.summary}><T w="bold" style={{color:colors.navy2}}>{customer.mealsPerDay ?? '—'} وجبات + {customer.snacksPerDay ?? '—'} سناك يوميًا</T><T style={s.copy}>{state.completed.filter(Boolean).length} من {state.slots.length} أيام مكتملة. اختياراتك مسودة حتى تؤكد إرسالها.</T></View>
        {state.limits.noMealPlan && <T accessibilityRole="alert">{BLOCKS.noMealPlan}</T>}
        {!!message && <T accessibilityRole="alert" style={s.link}>{message}</T>}
        <T accessibilityLiveRegion="polite" style={s.copy}>{saveState}</T>
        {mode==='smart'&&<PlanOverview customer={customer} rotation={rotationWeek} picks={freshPicks} catalog={catalog||[]} factor={factor} frozen={frozen} onRemove={removePick} onEdit={editDay} onReplace={swapPick}/>}
        {!state.slots.length ? <T accessibilityRole="alert">لا توجد أيام متاحة للاختيار في فترة اشتراكك. راجع الأخصائية إذا احتجت تجديد الاشتراك.</T> : mode==='manual'&&<>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {state.slots.map((slot, i) => {
              const locked = !dayNavigationAllowed(i,state.firstIncomplete,state.slots.length);
              const date = slotToDate(customer.startDate, rotationWeek, slot.week, slot.day);
              return <Pressable key={`${slot.week}:${slot.day}`} accessibilityRole="button" accessibilityState={{ selected: selected === i, disabled: locked || frozen }} disabled={locked || frozen}
                onPress={() => { setSelected(i); setKind('main'); setSearch(''); setMessage(''); }} style={[s.day, selected === i && s.dayActive, locked && { opacity: .5 }]}>
                <Ionicons name={locked ? 'lock-closed-outline' : state.completed[i] ? 'checkmark-circle' : 'calendar-outline'} size={18} color={colors.cyanDark}/>
                <T w="bold">{DAYS[slot.day]}</T><T style={s.copy}>{date?.slice(5)}</T>
              </Pressable>;
            })}
          </ScrollView>
          <T w="bold">{active && `${DAYS[active.day]} · أسبوع الطبخ ${active.week}`}</T>
          <View style={s.heading}><Chip label={`الوجبات ${counts.meals} / ${customer.mealsPerDay ?? '—'}`} active={kind === 'main'} onPress={() => setKind('main')}/><Chip label={`السناكات ${counts.snacks} / ${customer.snacksPerDay ?? '—'}`} active={kind === 'snack'} onPress={() => setKind('snack')}/></View>
          <TextInput accessibilityLabel={localize(String("ابحث في وجبات اليوم"))} placeholder={localize(String("ابحث في وجبات اليوم"))} placeholderTextColor={colors.muted2} value={search} onChangeText={setSearch} style={s.input}/>
        </>}
      </View>}
      renderItem={({ item }) => {
        const quantity = today.filter(p => p.meal._id === item._id).length;
        return <View style={{ width: cardWidth, gap: 8 }}><MealCard meal={{ ...item, ...scaledNutrition(item, factor) }} width={cardWidth} onPress={() => setConfirmation({ text: `${localizedField(item, 'name')}\n\n${localizedField(item, 'description') || item.nameEn || ''}`, accept: () => {} })}/>
          <View style={s.controls}><Pressable accessibilityRole="button" accessibilityLabel={localize(String(`إزالة نسخة من ${localizedField(item)}`))} disabled={!quantity || frozen} onPress={() => remove(item)} style={[s.touch, (!quantity || frozen) && { opacity: .4 }]}><Ionicons name="remove" size={22} color={colors.navy2}/></Pressable><T w="black" style={s.link}>{quantity}</T><Pressable accessibilityRole="button" accessibilityLabel={localize(String(`إضافة ${localizedField(item)}`))} disabled={frozen} onPress={() => add(item)} style={s.touch}><Ionicons name="add" size={22} color={colors.navy2}/></Pressable></View>
        </View>;
      }} ListEmptyComponent={mode==='manual'?<T style={s.copy}>لا توجد وجبات مطابقة لليوم والتصنيف المختار.</T>:null}/>
    <View style={s.footer}><T style={s.copy}>{state.completed.filter(Boolean).length} من {state.slots.length} أيام مكتملة · {picks.length} صنفًا</T><Btn label="مراجعة اختياراتك" disabled={!picks.length||generating} onPress={() => setReview(true)}/></View>
    <Modal visible={review} animationType="slide" onRequestClose={() => !busy && setReview(false)}><View style={[s.modal, { direction: uiLanguage()==='ar'?'rtl':'ltr', paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <T w="black" style={s.title}>مراجعة خطتك</T><T style={s.copy}>{saveState} · المسودة ليست طلبًا معتمدًا.</T><ScrollView contentContainerStyle={{ gap: 20, paddingVertical: 20 }}>
        {state.firstIncomplete>=0&&<View style={[s.summary,{gap:12}]}>
          <T w="bold">{t('الأيام التي تحتاج إكمالًا', 'Days that need completing')}</T>
          {state.slots.map((slot,index)=>{
            if(state.completed[index])return null;
            const dayCounts=countPicks(picksAt(freshPicks,slot.week,slot.day).map(p=>p.meal));
            const mealsMissing=Math.max(0,state.limits.mealsPerDay-dayCounts.meals);
            const snacksMissing=Math.max(0,state.limits.snacksPerDay-dayCounts.snacks);
            return <View key={slot.week+':'+slot.day} style={{gap:4}}>
              <T w="bold">{localize(DAYS[slot.day])} · {slotToDate(customer.startDate,rotationWeek,slot.week,slot.day)}</T>
              <T>{t('وجبات رئيسية ناقصة', 'Missing main meals')}: {mealsMissing} · {t('سناكات ناقصة', 'Missing snacks')}: {snacksMissing}</T>
            </View>;
          })}
          <Btn label={t('انتقل لأول يوم ناقص', 'Go to the first incomplete day')} disabled={frozen} onPress={()=>editDay(state.firstIncomplete)}/>
        </View>}
        {!!unavailablePicks.length&&<View style={[s.summary,{gap:8}]}>
          <T w="bold">{t('وجبات تحتاج مراجعة', 'Meals that need attention')}</T>
          {unavailablePicks.map((pick,index)=><T key={pick.meal._id+':'+index}>{localize(DAYS[pick.day]||pick.day)} · {slotToDate(customer.startDate,rotationWeek,pick.week,pick.day)} — {localizedField(pick.meal)}: {t('لم تعد متاحة لهذا اليوم؛ يلزم تبديلها.', 'No longer available for this day; replace this meal.')}</T>)}
        </View>}
        <PlanOverview customer={customer} rotation={rotationWeek} picks={freshPicks} catalog={catalog||[]} factor={factor} frozen={frozen} onRemove={removePick} onEdit={editDay} onReplace={swapPick}/>
        {!ready && <T accessibilityRole="alert">{unavailablePicks.length?'بعض الوجبات لم تعد متاحة. بدّلها قبل الإرسال: '+unavailablePicks.map(p=>localizedField(p.meal, 'name')).join('، '):state.shortfall.incompleteDays?'أكمل كل أيام الاشتراك أولًا. المتبقي: '+state.shortfall.mealsShort+' وجبة و'+state.shortfall.snacksShort+' سناك.':'الاختيارات لا تطابق فترة الاشتراك أو عدد الوجبات الحالي. راجع الأيام والعدد قبل الإرسال.'}</T>}
        {!!message && <T accessibilityRole="alert">{message}</T>}
      </ScrollView>
      {!ready&&!attempt.current&&<T accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.link}>{t('لا يمكن إرسال الخطة قبل إكمال جميع الوجبات والسناكات لكل أيام الاشتراك ومراجعة صلاحية الاختيارات.', 'You cannot submit the plan until all meals and snacks for every subscription day are complete and all selections are valid.')}</T>}
      <Btn label={busy ? 'جارٍ الإرسال…' : attempt.current ? 'إعادة المحاولة بنفس الطلب' : 'تأكيد وإرسال الخطة للأخصائية'} disabled={busy || (!ready && !attempt.current)} onPress={() => void submit()}/><Btn label="العودة للاختيارات" variant="outline" disabled={busy} onPress={() => setReview(false)}/>
    </View></Modal>
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={[s.backdrop,{direction:uiLanguage()==='ar'?'rtl':'ltr'}]}><View style={s.dialog}><T style={{ lineHeight: 26 }}>{confirmation?.text}</T><Btn label="متابعة" onPress={() => { const fn = confirmation?.accept; setConfirmation(null); fn?.(); }}/><Btn variant="outline" label="إلغاء" onPress={() => setConfirmation(null)}/></View></View></Modal>
  </View>;
}
const s = StyleSheet.create({
  list: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  title: { fontSize: 24, color: colors.navy2 }, copy: { fontSize: 13, lineHeight: 23, color: colors.muted2 }, link: { color: colors.cyanDark },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  summary: { backgroundColor: colors.cyanSoft, padding: 12, borderRadius: 16, gap: 4 },
  day: { minWidth: 84, padding: 8, gap: 2, alignItems: 'center', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  dayActive: { backgroundColor: colors.cyanSoft, borderColor: colors.cyanDark },
  input: { minHeight: 48, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 16, color: colors.navy2, fontFamily: fonts.regular, textAlign: 'right' },
  touch: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cyanSoft, borderRadius: 12 },
  footer: { padding: 16, gap: 8, backgroundColor: colors.card }, status: { flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: colors.bg },
  modal: { flex: 1, paddingHorizontal: 20, gap: 12, backgroundColor: colors.bg },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(7,19,31,0.65)' },
  dialog: { width: '100%', maxWidth: 440, backgroundColor: colors.card, padding: 24, borderRadius: 16, gap: 16 },
});
