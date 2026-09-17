import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Search, X, UtensilsCrossed, ArrowUp, Copy } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useQuery } from 'convex/react';
import { api } from '@/../../convex/_generated/api';
import './restaurant-catalog.css';

const categories = [
  ['breakfast','الفطور','Breakfast'], ['sandwiches','ساندويتشات وبرجر','Sandwiches & burgers'],
  ['chicken','الدجاج','Chicken'], ['beef','اللحوم','Beef'], ['seafood','الأسماك والروبيان','Seafood'],
  ['pasta','الباستا والنودلز','Pasta & noodles'], ['salads','السلطات والشوربات','Salads & soups'],
  ['snacks','الحلويات والسناك','Desserts & snacks'], ['drinks','العصائر والمشروبات','Drinks'],
  ['boxes','بوكسات المشاركة','Gathering boxes'], ['other','أطباق متنوعة','More dishes'],
];
const channelNames: Record<string,string[]> = {online:['أونلاين','Online'], subscription:['وجبات باقات الاشتراك','Subscription dishes'],outlet:['منافذ','Outlets']};
type Dish = {id:string;sourceIds:string[];ingredients:string[];ar:string;en:string;category:string;channels:string[];image:string|null;calories:number|null;protein:number|null;carbs:number|null;fats:number|null};
const none: Dish[] = [];
export default function RestaurantCatalog() {
  // قراءة حية: صورة أو سعرات تُعدَّل في لوحة التحكم تظهر هنا فوراً (كانت لقطة مجمّدة داخل الكود).
  const live = useQuery(api.restaurantCatalog.list, {}) as Dish[] | undefined;
  const catalog = live ?? none;
  const {language,setLanguage} = useLanguage();
  const ar = language === 'ar';
  const [query,setQuery] = useState('');
  const search=useSearch();
  const [location,navigate]=useLocation();
  const requestedChannel=new URLSearchParams(search).get('menu') || 'all';
  const channel=Object.hasOwn(channelNames,requestedChannel)?requestedChannel:'all';
  const setChannel=(value:string)=>{const next=new URLSearchParams(search);if(value==='all')next.delete('menu');else next.set('menu',value);navigate(location+(next.size?'?'+next.toString():''),{replace:true});setShareStatus('');};
  const [shareStatus,setShareStatus]=useState('');
  const [shareFallback,setShareFallback]=useState('');
  const copyMenu=async()=>{const url=new URL(window.location.href);url.hash='';try{await navigator.clipboard.writeText(url.toString());setShareStatus(ar?'تم نسخ رابط المنيو':'Menu link copied');setShareFallback('');}catch{setShareFallback(url.toString());setShareStatus(ar?'انسخ الرابط من الحقل التالي':'Copy the link below');}};
  const menuMeals=useMemo(()=>catalog.filter(m=>channel==='all'||m.channels.includes(channel)),[channel,catalog]);
  const [active,setActive] = useState('all');
  const [broken,setBroken] = useState<Record<string,boolean>>({});
  const filtered = useMemo(()=>menuMeals.filter(m=>(`${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))),[query,menuMeals]);
  const sections=categories.map(c=>({c,meals:filtered.filter(m=>m.category===c[0])})).filter(s=>s.meals.length);
  const count=filtered.filter(m=>active==='all'||m.category===active).length;
  const featured = ['seafood','chicken','sandwiches'].map(category=>menuMeals.find(m=>m.category===category&&m.image)).filter((m): m is Dish=>Boolean(m));
  return <div className="restaurant-catalog" dir={ar?'rtl':'ltr'}>
    <header className="rc-header"><Link href="/public"><img src="/adrenaline-logo-full.png" alt="Adrenaline Healthy Food" /></Link><div><button onClick={()=>{setChannel(channel==='subscription'?'all':'subscription');setQuery('');setActive('all');}}>{channel==='subscription'?(ar?'كل منيو المطعم':'Full restaurant menu'):(ar?'وجبات الاشتراك':'Subscription meals')}</button><button onClick={()=>setLanguage(ar?'en':'ar')}>{ar?'English':'العربية'}</button></div></header>
    <main className="rc-main"><Link className="rc-share" href="/public/menu">{ar?'اختيار وجبات اشتراكي':'Choose my subscription meals'}</Link>
      <section className="rc-intro"><div className="rc-intro-copy"><h1>{channel==='subscription'?(ar?'وجبات اشتراكك،':'Your subscription.'):(ar?'كل اللي تحبه،':'Your favourites.')}<br/><span>{channel==='subscription'?(ar?'كلها قدامك.':'Every dish.'):(ar?'في منيو واحد.':'One menu.')}</span></h1><p>{channel==='subscription'?(ar?'تصفح كل وجبات الاشتراكات واكتشف اختياراتك المفضلة.':'Browse all subscription dishes and find your favourites.'):(ar?'اكتشف أطباق أدرينالين، من الفطور لآخر لقمة.':'Explore Adrenaline, from breakfast to your last bite.')}</p><a className="rc-explore" href="#catalog-tools">{ar?'استكشف المنيو':'Explore the menu'} <span aria-hidden="true">↓</span></a><span className="rc-hero-count">{menuMeals.length} {ar?'صنف • اختار اللي على مزاجك':'dishes • find your favourite'}</span></div><div className="rc-featured">{featured.map((m,i)=><button key={m.id} className={`rc-feature rc-feature-${i}`} onClick={()=>{setQuery('');setActive(m.category);document.getElementById('catalog-tools')?.scrollIntoView({block:'start'});}}><img src={m.image!} alt="" width="400" height="400" fetchPriority={i===0?'high':'auto'}/><span>{ar?(m.ar||m.en):m.en}</span></button>)}</div></section>
      <nav className="rc-menu-tabs" aria-label={ar?'نوع المنيو':'Menu type'}>{[['all',ar?'المنيو كامل':'Full menu'],...Object.entries(channelNames).map(([key,n])=>[key,n[ar?0:1]])].map(([key,label])=><button key={key} aria-pressed={channel===key} onClick={()=>{setChannel(key);setQuery('');setActive('all');}}>{label}</button>)}</nav>
      <div className="rc-share"><button onClick={copyMenu}><Copy size={17}/>{ar?'نسخ رابط المنيو':'Copy menu link'}</button><span role="status">{shareStatus}</span>{shareFallback&&<input aria-label={ar?'رابط المنيو':'Menu link'} value={shareFallback} readOnly dir="ltr" onFocus={e=>e.target.select()}/>}</div>
      <div className="rc-tools" id="catalog-tools"><label className="rc-search"><Search size={19}/><span className="sr-only">{ar?'ابحث في المنيو':'Search menu'}</span><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setActive('all');}} placeholder={ar?'دور على وجبتك المفضلة…':'Find your favourite dish…'}/>{query&&<button aria-label={ar?'مسح البحث':'Clear search'} onClick={()=>setQuery('')}><X size={18}/></button>}</label></div>
      <nav className="rc-categories" aria-label={ar?'أقسام المنيو':'Menu categories'}><button aria-pressed={active==='all'} onClick={()=>setActive('all')}>{ar?'الكل':'All'} <span>{filtered.length}</span></button>{sections.map(({c,meals})=><button key={c[0]} aria-pressed={active===c[0]} onClick={()=>setActive(c[0])}>{c[ar?1:2]} <span>{meals.length}</span></button>)}</nav>
      <p className="rc-results" role="status">{count} {ar?'صنف':'dishes'}</p>
      {sections.filter(s=>active==='all'||s.c[0]===active).map(({c,meals})=><section className="rc-section" key={c[0]}><h2>{c[ar?1:2]} <span>{meals.length}</span></h2><div className="rc-grid">{meals.map(m=><article className="rc-card" key={m.id}>
        {m.image&&!broken[m.id]?<img className="rc-photo" src={m.image} alt={m.ar||m.en} loading="lazy" width="400" height="320" onError={()=>setBroken(old=>({...old,[m.id]:true}))}/>:<div className="rc-no-photo"><UtensilsCrossed size={28}/><span>{ar?'الصورة قريبًا':'Photo coming soon'}</span></div>}
        <div className="rc-body"><div className="rc-channels">{m.channels.map(ch=><span key={ch}>{channelNames[ch][ar?0:1]}</span>)}</div><h3 dir={ar&&m.ar?'rtl':'ltr'}>{ar?(m.ar||m.en):m.en}</h3>{ar&&m.ar&&<p className="rc-english" lang="en" dir="ltr">{m.en}</p>}{m.ingredients.length>0&&<p className="rc-ingredients"><strong>{ar?'المكونات: ':'Ingredients: '}</strong>{m.ingredients.join(ar?'، ':', ')}</p>}<dl className="rc-macros">{([['calories',ar?'سعرة':'kcal'],['protein',ar?'بروتين':'Protein'],['carbs',ar?'كارب':'Carbs'],['fats',ar?'دهون':'Fat']] as const).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{m[k]===null?'—':m[k]}{m[k]!==null&&k!=='calories'&&<small>g</small>}</dd></div>)}</dl></div>
      </article>)}</div></section>)}
      {live===undefined&&<p className="rc-results" role="status">{ar?'جارٍ تحميل المنيو…':'Loading the menu…'}</p>}
      {live!==undefined&&!count&&<div className="rc-empty"><Search size={28}/><h2>{ar?'مفيش نتائج بالاختيار ده':'No dishes found'}</h2><button onClick={()=>{setQuery('');setActive('all');}}>{ar?'عرض كل المنيو':'Show all dishes'}</button></div>}
      <footer className="rc-footer"><p>{ar?'أدرينالين • وجبات صحية، بطعم تحبه.':'Adrenaline • Healthy food you love.'}</p><a href="#" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}><ArrowUp size={16}/>{ar?'للأعلى':'Back to top'}</a></footer>
    </main>
  </div>;
}
