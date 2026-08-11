import { ShieldCheck, FileText, Mail } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

const updatedAr = "7 أغسطس 2026";
const updatedEn = "7 August 2026";

function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const { dir } = useLanguage();
  const ar = dir === "rtl";
  const privacy = type === "privacy";
  const title = privacy
    ? (ar ? "سياسة الخصوصية" : "Privacy Policy")
    : (ar ? "الشروط والأحكام" : "Terms and Conditions");

  useSeo({
    title: `${title} | Adrenaline Healthy Food`,
    description: privacy
      ? (ar ? "كيف تجمع أدرينالين بيانات المشتركين وتستخدمها وتحميها وتحذفها." : "How Adrenaline collects, uses, protects, and deletes subscriber data.")
      : (ar ? "شروط استخدام خدمات واشتراكات أدرينالين للوجبات الصحية." : "Terms for using Adrenaline Healthy Food services and subscriptions."),
    path: privacy ? "/privacy" : "/terms",
  });

  const privacySections = ar ? [
    ["البيانات التي نجمعها", "قد نجمع الاسم ورقم الهاتف والبريد الإلكتروني وعنوان التوصيل وبيانات الاشتراك والطلبات، إضافة إلى المعلومات الغذائية التي يزوّدنا بها المشترك مثل الهدف والحساسية والتفضيلات. لا نطلب بيانات لا ترتبط بتقديم الخدمة."],
    ["كيف نستخدم البيانات", "نستخدم البيانات لإنشاء الحساب، إدارة الاشتراك، إعداد الوجبات بأمان، تنفيذ التوصيل، التواصل بشأن الطلب، تقديم الدعم، ومنع إساءة الاستخدام. لا نبيع البيانات الشخصية."],
    ["مشاركة البيانات", "تُتاح البيانات بالقدر اللازم فقط لفريق أدرينالين ومقدمي الخدمات الذين يساعدون في تشغيل التطبيق والاستضافة والتوصيل، مع التزامهم بحماية البيانات."],
    ["الاحتفاظ والحذف", "يمكن حذف حساب التطبيق من صفحة حسابي. عند الحذف تُزال بيانات الدخول وتُلغى جميع الجلسات فورًا. قد نحتفظ بسجلات الطلبات أو الاشتراك أو السجلات المالية للمدة اللازمة لتنفيذ الخدمة والالتزامات القانونية والمحاسبية، ثم نحذفها أو نخفي هويتها عندما لا تعود مطلوبة."],
    ["الأمان", "نستخدم اتصالًا مشفرًا وضوابط صلاحيات لحماية البيانات. لا توجد وسيلة إلكترونية آمنة بنسبة 100%، لذلك نراجع إجراءات الحماية باستمرار."],
    ["حقوقك والتواصل", "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها عبر صفحة الدعم أو البريد الإلكتروني. سنطلب ما يكفي للتحقق من هويتك قبل تنفيذ الطلب."],
  ] : [
    ["Data we collect", "We may collect your name, phone number, email, delivery address, subscription and order details, and dietary information you provide, such as goals, allergies, and preferences. We do not request data unrelated to delivering the service."],
    ["How we use data", "We use data to create your account, manage subscriptions, prepare meals safely, deliver orders, communicate about your service, provide support, and prevent abuse. We do not sell personal data."],
    ["Data sharing", "Data is available only as necessary to Adrenaline staff and service providers supporting hosting, app operations, and delivery, subject to appropriate protection obligations."],
    ["Retention and deletion", "You can delete your app account from My Profile. Login credentials and active sessions are removed immediately. Order, subscription, or financial records may be retained only as needed to fulfil services and meet legal or accounting obligations, then deleted or de-identified when no longer required."],
    ["Security", "We use encrypted connections and access controls to protect data. No electronic method is completely secure, so we continually review our safeguards."],
    ["Your choices and contact", "You can request access, correction, or deletion through the support page or by email. We may verify your identity before completing a request."],
  ];

  const termsSections = ar ? [
    ["الخدمة", "توفر أدرينالين خطط وجبات واشتراكات وتوصيل داخل المناطق التي تغطيها الخدمة. تفاصيل الخطة والسعر والمدة الظاهرة عند الطلب هي المرجع للاشتراك."],
    ["الحساب", "يتحمل المستخدم مسؤولية صحة بياناته والمحافظة على سرية بيانات الدخول. يجب إبلاغ الدعم فور الاشتباه في استخدام غير مصرح به."],
    ["الحساسية والمعلومات الغذائية", "يجب إدخال الحساسية والممنوعات بدقة وإبلاغ فريق التغذية بأي تغيير. المعلومات الغذائية والخطط لا تُعد تشخيصًا أو علاجًا طبيًا."],
    ["التعديل والتجميد والإلغاء", "تخضع تغييرات الوجبات والتجميد والإلغاء لمواعيد التحضير وسياسة الباقة المتفق عليها. قد لا يمكن تعديل وجبة بدأ تجهيزها."],
    ["التوصيل", "يجب توفير عنوان ورقم هاتف صحيحين وإتاحة استلام الطلب خلال الوقت المحدد. قد تتغير المواعيد بسبب ظروف خارجة عن السيطرة مع إخطار المشترك متى أمكن."],
    ["التواصل", "لأي سؤال أو شكوى أو طلب متعلق بالحساب، استخدم صفحة الدعم. استمرار استخدام الخدمة يعني الموافقة على هذه الشروط وأي تحديثات معلنة."],
  ] : [
    ["Service", "Adrenaline provides meal plans, subscriptions, and delivery within supported areas. The plan, price, and duration shown when ordering govern the subscription."],
    ["Account", "You are responsible for accurate account information and keeping login details confidential. Contact support immediately if you suspect unauthorized use."],
    ["Allergies and nutrition", "You must provide accurate allergy and exclusion information and notify the nutrition team of changes. Nutrition information and meal plans are not medical diagnosis or treatment."],
    ["Changes, pauses, and cancellation", "Meal changes, pauses, and cancellation are subject to preparation cutoffs and the agreed package policy. A meal already in preparation may not be changeable."],
    ["Delivery", "You must provide a correct address and phone number and be available to receive orders. Delivery times may change because of circumstances outside our control, with notice where possible."],
    ["Contact", "For questions, complaints, or account requests, use the support page. Continued use means acceptance of these terms and announced updates."],
  ];

  const sections = privacy ? privacySections : termsSections;
  const Icon = privacy ? ShieldCheck : FileText;
  return (
    <PublicLayout>
      <div className="bg-slate-50 px-4 py-10 sm:py-14">
        <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
          <header className="mb-8 border-b border-slate-100 pb-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-[#0E76AC]">
              <Icon className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black text-[#0F1516] sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{ar ? `آخر تحديث: ${updatedAr}` : `Last updated: ${updatedEn}`}</p>
          </header>
          <div className="space-y-7">
            {sections.map(([heading, body]) => (
              <section key={heading}>
                <h2 className="mb-2 text-lg font-extrabold text-slate-900">{heading}</h2>
                <p className="max-w-[72ch] text-[15px] leading-8 text-slate-600">{body}</p>
              </section>
            ))}
          </div>
          <a href="/support" className="mt-9 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0E76AC] px-5 font-bold text-white hover:bg-[#095F8B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200">
            <Mail className="size-4" />
            {ar ? "تواصل مع الدعم" : "Contact support"}
          </a>
        </article>
      </div>
    </PublicLayout>
  );
}

export function PrivacyPolicy() { return <LegalPage type="privacy" />; }
export function TermsAndConditions() { return <LegalPage type="terms" />; }
