import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "convex/react";
import { Printer, MessageCircle } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { printCurrentPage } from "@/lib/native";
import "./about.css";
import { mealArtworkUrl } from "@/lib/mealArtwork";

/** A concise company introduction; meal selection and subscriptions keep their own routes. */
export default function AboutPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (arabic: string, english: string) => ar ? arabic : english;
  const settings = useQuery(api.restaurantSettings.get);
  const [printError, setPrintError] = useState(false);
  const phone = String(settings?.phone || "97451144366").replace(/\D/g, "");
  const whatsapp = (message: string) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  useSeo({ title: "من نحن | أدرينالين للوجبات الصحية", description: "أدرينالين — مطبخ وجبات صحية في قطر يقدّم أكل لذيذ محسوب السعرات بإشراف أخصائيي تغذية.", path: "/public/about" });

  return <PublicLayout>
    <article className="about-page" dir={ar ? "rtl" : "ltr"}>
      <section className="about-hero about-wrap" aria-labelledby="about-title">
        <div className="about-intro">
          <img className="about-logo" src="/adrenaline-logo.png" alt="Adrenaline Healthy Food" />
          <h1 id="about-title">{t("الأكل الصحي.. خيارٌ يومي", "Healthy food. A daily choice.")}</h1>
          <p>{t("أدرينالين علامة قطرية متخصّصة في الأكل الصحي، نقدّم وجباتٍ طازجة ومتوازنة تُحضَّر يوميًا بإشراف اختصاصيي تغذية. نجعل الخيار الصحي سهلًا ولذيذًا — في الفرع أو عبر التوصيل في جميع أنحاء قطر.", "Adrenaline is a Qatari brand specializing in healthy food, offering fresh and balanced meals prepared daily under the supervision of nutritionists. We make the healthy choice easy and delicious — at our branch or through delivery across Qatar.")}</p>
          <div className="about-actions">
            <Link className="about-button" href="/public/plans">{t("اكتشف الباقات", "Explore plans")}</Link>
            <Link className="about-text-link" href="/public/menu">{t("تصفّح قائمة الوجبات", "Browse our menu")}</Link>
          </div>
        </div>
        <img className="about-hero-photo" src="/plan-artwork/plan-fitness.png" alt={t("باقة أدرينالين بالبوكس الأزرق والوجبات بتغليف المطعم", "Adrenaline meal plan with the blue branded box and packaged meals")} fetchPriority="high" />
      </section>

      <section className="about-soft" aria-labelledby="order-options-title"><div className="about-wrap about-section">
        <h2 id="order-options-title">{t("وجبتك بطريقتك.. مش بس اشتراكات", "Your meal, your way. Not just subscriptions.")}</h2>
        <p>{t("طلبات الوجبات أونلاين تتم فقط عبر تطبيقات التوصيل. وللاشتراكات واختيار الباقة المناسبة، تواصل مع الأخصائية.", "Online meal orders are placed exclusively through delivery apps. For subscriptions and help choosing a plan, contact our nutritionist.")}</p>
        <div className="about-order-options">
          <div><h3>{t("تواصل مع الأخصائية", "Talk to our nutritionist")}</h3>
            <p>{t("للاستفسار عن الاشتراكات واختيار الباقة المناسبة لأهدافك، تواصل مع الأخصائية عبر واتساب. طلب الوجبات أونلاين يكون عبر تطبيقات التوصيل فقط.", "Contact our nutritionist on WhatsApp for subscription enquiries and help choosing a plan for your goals. Online meal orders are available only through delivery apps.")}</p>
            <a className="about-button" href={whatsapp(t("مرحباً، أرغب في التواصل مع الأخصائية للاستفسار عن الاشتراكات واختيار الباقة المناسبة.", "Hello, I'd like to speak with the nutritionist about subscriptions and choosing a suitable plan."))} target="_blank" rel="noopener noreferrer">{t("استفسر عن الاشتراك", "Enquire about a subscription")}</a>
          </div>
          <div><h3>{t("على تطبيقات التوصيل", "On delivery apps")}</h3>
            <p>{t("تجدنا على طلبات، سنونو، ديليفرو، كيتا ورفيق. اختر تطبيقك وابحث عن أدرينالين.", "Find us on Talabat, Snoonu, Deliveroo, Keeta and Rafeeq. Open your preferred app and search for Adrenaline.")}</p>
            <p>{t("اختر وجبتك وأكمل الطلب داخل تطبيق التوصيل.", "Choose your meal and complete your order in the delivery app.")}</p>
          </div>
          <div><h3>{t("اشتراكات تناسب أهدافك", "Plans for your goals")}</h3>
            <p>{t("لو تحب ترتّب وجباتك لأيام اشتراكك، اكتشف الباقات واختر الأنسب لك.", "Prefer to plan your meals ahead? Explore our subscription options and choose the one that suits you.")}</p>
            <Link className="about-text-link" href="/public/plans">{t("استعرض باقات الاشتراك", "View subscription plans")}</Link>
          </div>
        </div>
      </div></section>
      <section className="about-wrap about-section about-story" aria-labelledby="story-title">
        <div>
          <h2 id="story-title">{t("قصتنا", "Our story")}</h2>
          <p>{t("بدأت أدرينالين من قناعةٍ بسيطة: أنّ الطعام الصحي يجب أن يكون متاحًا، لذيذًا، وملائمًا لإيقاع الحياة اليومي. من هذه الفكرة وُلِد مطبخٌ يحضّر وجباتٍ متوازنة طازجة، وثلاجةٌ جاهزة تتيح للعميل أن يختار وجبته الصحية في ثوانٍ.", "Adrenaline started from a simple belief: that healthy food should be accessible, delicious, and fit for daily life. From this idea, a kitchen was born that prepares fresh balanced meals, and a ready-to-grab fridge that lets customers pick their healthy meal in seconds.")}</p>
        </div>
        <div className="about-direction">
          <div><h3>{t("رؤيتنا", "Our vision")}</h3><p>{t("أن نكون الخيار الأول للأكل الصحي في قطر والمنطقة، وأن نجعل نمط الحياة الصحي في متناول الجميع.", "To be the first choice for healthy food in Qatar and the region, and to make a healthy lifestyle accessible to everyone.")}</p></div>
          <div><h3>{t("رسالتنا", "Our mission")}</h3><p>{t("تقديم وجباتٍ صحية لذيذة ومتوازنة، طازجة يوميًا وبإشراف اختصاصي تغذية، عبر تجربةٍ سهلة في الفرع وخدمة توصيل موثوقة.", "Offering delicious and balanced healthy meals, fresh daily under nutritionist supervision, through an easy in-branch experience and reliable delivery service.")}</p></div>
        </div>
      </section>

      <section className="about-soft" aria-labelledby="values-title"><div className="about-wrap about-section">
        <h2 id="values-title">{t("ما يميّز وجباتنا", "What goes into every meal")}</h2>
        <div className="about-features">
          <div><h3>{t("إشراف تغذوي", "Nutrition supervision")}</h3><p>{t("قوائمنا يصمّمها اختصاصيو تغذية بسعراتٍ ونِسبٍ غذائية محسوبة.", "Our menus are designed by nutritionists with calculated calories and macros.")}</p></div>
          <div><h3>{t("تحضير يومي", "Prepared daily")}</h3><p>{t("مكوّناتٌ مختارة وتحضيرٌ يومي وفق معايير عالية.", "Carefully selected ingredients and daily preparation to the highest standards.")}</p></div>
          <div><h3>{t("تنوّع يناسب يومك", "Variety for your day")}</h3><p>{t("قوائم تناسب كل ذوقٍ وهدف — من الفطور إلى الحلويات.", "Menus for every taste and goal — from breakfast to desserts.")}</p></div>
        </div>
        <div className="about-meals">
          <figure><img src={mealArtworkUrl({_id:"kh79jgzmz0v4wpm7dsk4190xvs80t9v1"})} loading="lazy" alt={t("سالمون بالعسل", "Honey glaze salmon")} /><figcaption>{t("سالمون بالعسل", "Honey glaze salmon")}</figcaption></figure>
          <figure><img src={mealArtworkUrl({_id:"kh72m8v8s5tjyfy2fgtjjr69p580t7me"})} loading="lazy" alt={t("ستيك بزبدة الثوم والبطاطس", "Garlic butter steak")} /><figcaption>{t("ستيك بزبدة الثوم والبطاطس", "Garlic butter steak")}</figcaption></figure>
          <figure><img src={mealArtworkUrl({_id:"kh73m1xw4rqdgznasfsca5hp5180v3nt"})} loading="lazy" alt={t("باستا الدجاج بالكاجون", "Cajun chicken pasta")} /><figcaption>{t("باستا الدجاج بالكاجون", "Cajun chicken pasta")}</figcaption></figure>
        </div>
        <Link className="about-text-link" href="/public/menu">{t("شاهد القائمة كاملة", "See the full menu")}</Link>
      </div></section>

      <section className="about-wrap about-section" aria-labelledby="events-title">
        <div className="about-event-intro">
          <h2 id="events-title">{t("ومعكم في مناسباتكم", "Part of your occasions")}</h2>
          <div><p>{t("من اجتماعٍ في وزارة إلى حفلٍ يضمّ المئات: التخطيط والتحضير والتقديم من مطبخنا نفسه.", "From a ministry meeting to a hall of hundreds — planned, prepared and served from our own kitchen.")}</p>
          <p>{t("الجهات الحكومية والشركات، المؤتمرات والمعارض، المناسبات الخاصة، المدارس والجامعات، والأندية الرياضية.", "Government and corporate events, conferences and exhibitions, private occasions, schools and universities, and sports clubs.")}</p></div>
        </div>
        <div className="about-events">
          <figure><img src="/events/event-1.jpg" loading="lazy" alt={t("شراكة مع مدرسة قطر للعلوم والتكنولوجيا", "Partnership with Qatar Science & Technology School")} /><figcaption>{t("شراكة مع مدرسة قطر للعلوم والتكنولوجيا", "Partnership with Qatar Science & Technology School")}</figcaption></figure>
          <div className="about-event-services">
            <div><h3>{t("ضيافة الشركات والجهات الحكومية", "Corporate and government hospitality")}</h3><p>{t("اجتماعات ومؤتمرات رسمية بفواتير وأوراق معتمدة.", "Official meetings and conferences, with proper invoicing.")}</p></div>
            <div><h3>{t("المناسبات الخاصة", "Private occasions")}</h3><p>{t("قوائم تُفصَّل معكم، وتقديم يليق بالمناسبة.", "Menus tailored with you, served as the occasion deserves.")}</p></div>
            <div><h3>{t("المدارس والفعاليات الرياضية", "Schools and sports events")}</h3><p>{t("شراكات وأيام تعريفية، ووجباتٌ محسوبة السعرات لطبيعة الحدث.", "Partnerships, open days, and calorie-counted catering built for the occasion.")}</p></div>
          </div>
        </div>
        <a className="about-button about-outline" href={whatsapp(t("مرحباً، أرغب في عرض سعر لتغطية فعالية.\nنوع المناسبة:\nالتاريخ:\nعدد الضيوف:", "Hello, I'd like a quote for event catering.\nOccasion:\nDate:\nGuests:"))} target="_blank" rel="noopener noreferrer">{t("اطلب عرض سعر لفعاليتك", "Request an event quote")}</a>
      </section>

      <section className="about-wrap about-section about-locations" aria-labelledby="locations-title">
        <h2 id="locations-title">{t("مواقعنا", "Find us")}</h2>
        <div className="about-branches">
          <div><h3>{t("المطبخ الرئيسي — الثمامة", "Central kitchen — Al Thumama")}</h3><p>{t("الإنتاج والتوزيع", "Production and distribution")}</p><p>{t("المطبخ المركزي الذي تُحضَّر فيه الوجبات يوميًا وتُوزَّع منه على الفرع وخدمات التوصيل في جميع أنحاء قطر.", "The central kitchen where meals are prepared daily and distributed to branches and delivery services across Qatar.")}</p></div>
          <div><h3>{t("فرع المرخية — الدوحة", "Al Maarkhiya branch — Doha")}</h3><p>{t("بيع وأخذ مباشر", "Direct sales and pick-up")}</p><p>{t("نقطة البيع والأخذ المباشر، حيث تختار وجبتك الصحية من ثلاجة العرض في ثوانٍ.", "The direct sales point, where you choose your healthy meal from the display fridge in seconds.")}</p></div>
          <div><h3>{t("فرع لوسيل — لوسيل", "Lusail branch — Lusail")}</h3><p>{t("بيع وأخذ مباشر", "Direct sales and pick-up")}</p><p>{t("فرعنا في مدينة لوسيل، يقدّم التجربة نفسها من الاختيار المباشر للوجبات الصحية الطازجة.", "Our branch in Lusail City, offering the same experience of directly choosing fresh healthy meals.")}</p></div>
        </div>
        <p className="about-delivery">{t("متوفّرون عبر تطبيقات التوصيل: طلبات · سنونو · ديليفرو · كيتا · رفيق", "Available on delivery apps: Talabat · Snoonu · Deliveroo · Keeta · Rafeeq")}</p>
      </section>

      <section className="about-contact" aria-labelledby="contact-title"><div className="about-wrap">
        <div><h2 id="contact-title">{t("لنبقَ على تواصل", "Let's stay connected")}</h2><p>{t("للاستفسار، الاشتراك، أو استشارة اختصاصي التغذية", "For inquiries, subscriptions, or nutrition consultation")}</p></div>
        <a className="about-button" href={whatsapp(t("مرحباً، أرغب في الاستفسار عن خدمات أدرينالين.", "Hello, I'd like to inquire about Adrenaline services."))} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" />{t("تواصل عبر واتساب", "Contact on WhatsApp")}<bdi>+{phone}</bdi></a>
        <div className="about-end"><span>{t("السجل التجاري", "Commercial registration")} · <bdi>195910/01</bdi></span><button type="button" onClick={async () => { setPrintError(false); try { await printCurrentPage(); } catch { setPrintError(true); } }}><Printer size={18} aria-hidden="true" />{t("طباعة الصفحة", "Print this page")}</button></div>
        {printError && <p role="alert">{t("تعذّرت الطباعة. حاول مرة أخرى.", "Could not print. Please try again.")}</p>}
      </div></section>
    </article>
  </PublicLayout>;
}
