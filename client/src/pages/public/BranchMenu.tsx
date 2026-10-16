/**
 * Read-only menu of one outlet, opened from the QR code on its tables (/westbay).
 * Not linked from the site and marked noindex: it is meant for people standing at the outlet.
 * Items and prices come live from the branch POS menu, so a price change shows here at once.
 */
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getPosMealImage, getPosMealImageById } from "@/lib/posMealImages";

type Item = { id: string; nameEn: string; nameAr: string; category: string; price: number; imageUrl: string | null };

// Sections follow the printed menu. New items fall into the closest one by name.
const SECTIONS: { en: string; ar: string; test: (i: Item) => boolean }[] = [
  { en: "Drinks", ar: "المشروبات", test: (i) => /water|cola|red ?bull|juice|coffee|drink|shot/i.test(i.nameEn) },
  { en: "Burgers, Sandwiches & Wraps", ar: "برجر وساندويتشات", test: (i) => /burger|sandwich|wrap|shawarma(?!.*rice)/i.test(i.nameEn) },
  { en: "Sweets & Protein Bites", ar: "الحلويات والسناك", test: (i) => /snack|breakfast/i.test(i.category) },
  { en: "Signature Plates", ar: "الأطباق الرئيسية", test: () => true },
];
const ORDER = ["Signature Plates", "Burgers, Sandwiches & Wraps", "Sweets & Protein Bites", "Drinks"];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function BranchMenu({ code = "003", label = "WEST BAY", labelAr = "ويست باي" }: { code?: string; label?: string; labelAr?: string }) {
  const data = useQuery(api.posBranches.publicMenu, { code }) as { name: string; items: Item[] } | null | undefined;

  useEffect(() => {
    const added: HTMLElement[] = [];
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex, nofollow";
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Playfair+Display:ital,wght@1,700&display=swap";
    added.push(robots, font);
    added.forEach((el) => document.head.appendChild(el));
    const prevTitle = document.title;
    document.title = `Adrenaline · ${label} Menu`;
    return () => { added.forEach((el) => el.remove()); document.title = prevTitle; };
  }, [label]);

  const groups = new Map<string, Item[]>(ORDER.map((k) => [k, []]));
  for (const it of data?.items || []) groups.get(SECTIONS.find((s) => s.test(it))!.en)!.push(it);

  return (
    <div className="bm">
      <style>{CSS}</style>
      <header className="bm-head">
        <img src="/adrenaline-logo-dark.png" alt="Adrenaline Healthy Food" className="bm-logo" />
        <h1 className="bm-title">Menu</h1>
        <p className="bm-branch"><span>{label}</span><i /><span dir="rtl">{labelAr}</span></p>
      </header>

      <main className="bm-main">
        {data === undefined && <p className="bm-note">Loading… · جاري التحميل</p>}
        {data === null && <p className="bm-note">Menu unavailable · المنيو غير متاح</p>}
        {ORDER.map((key) => {
          const list = groups.get(key)!;
          if (!list.length) return null;
          const sec = SECTIONS.find((s) => s.en === key)!;
          return (
            <section key={key} className="bm-sec">
              <h2 className="bm-sec-h"><span>{sec.en}</span><b /><span dir="rtl" className="ar">{sec.ar}</span></h2>
              <div className="bm-grid">
                {list.map((it) => {
                  const src = it.imageUrl || getPosMealImageById(it.id) || getPosMealImage(it.nameEn);
                  return (
                    <article key={it.id} className="bm-card">
                      <div className="bm-photo">
                        {src ? <img src={src} alt={it.nameEn} loading="lazy" /> : <div className="bm-ph">{it.nameAr}</div>}
                        <span className="bm-price"><b>{fmt(it.price)}</b><i>QAR</i></span>
                      </div>
                      <h3>{it.nameEn}</h3>
                      <span className="bm-tick" />
                      <p dir="rtl">{it.nameAr}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
      <footer className="bm-foot">Prices in Qatari Riyals · <span dir="rtl">الأسعار بالريال القطري</span></footer>
    </div>
  );
}

const CSS = `
.bm{--cyan:#3CC4F0;--deep:#0B3B57;--ink:#10202A;--muted:#5E7480;min-height:100vh;background:#F2F7F9;color:var(--ink);font-family:Tajawal,Cairo,sans-serif}
.bm-head{background:var(--deep);background-image:radial-gradient(120% 90% at 50% 120%,rgba(60,196,240,.3),transparent 60%);color:#fff;text-align:center;padding:28px 16px 26px;border-top:5px solid var(--cyan)}
.bm-logo{height:44px;margin:0 auto}
.bm-title{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:64px;line-height:1;margin:14px 0 6px}
.bm-branch{display:flex;align-items:center;justify-content:center;gap:12px;font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.3em;font-size:17px}
.bm-branch span[dir]{font-family:Tajawal,sans-serif;letter-spacing:0;color:#9fd3e6}
.bm-branch i{width:28px;height:2px;background:var(--cyan)}
.bm-main{max-width:1040px;margin:0 auto;padding:22px 16px 8px}
.bm-note{text-align:center;color:var(--muted);padding:40px 0;font-weight:700}
.bm-sec{margin-bottom:26px}
.bm-sec-h{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;text-transform:uppercase;letter-spacing:.05em;color:var(--deep)}
.bm-sec-h b{flex:1;height:2px;background:linear-gradient(90deg,var(--cyan),transparent)}
.bm-sec-h .ar{font-family:Tajawal,sans-serif;text-transform:none;letter-spacing:0;font-size:17px}
.bm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(min-width:640px){.bm-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(min-width:900px){.bm-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.bm-card{background:#fff;border:1px solid #e1edf2;border-radius:16px;padding:6px 6px 12px;text-align:center;box-shadow:0 1px 2px rgba(11,59,87,.06),0 8px 18px -6px rgba(11,59,87,.14)}
.bm-photo{position:relative;aspect-ratio:1/1;border-radius:12px;background:#eef5f8;margin-bottom:18px}
.bm-photo img{width:100%;height:100%;object-fit:cover;border-radius:12px;display:block}
.bm-ph{height:100%;display:grid;place-items:center;font-weight:800;color:var(--deep);padding:8px;border-radius:12px;background:repeating-linear-gradient(135deg,#d6edf4 0 10px,#e6f4f8 10px 20px)}
.bm-price{position:absolute;inset-inline-start:8px;bottom:-12px;display:flex;align-items:baseline;gap:3px;background:var(--deep);color:#fff;border-radius:99px;padding:4px 10px;box-shadow:0 3px 8px rgba(11,59,87,.3)}
.bm-price b{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;line-height:1}
.bm-price i{font-style:normal;font-size:9px;font-weight:800;letter-spacing:.14em;color:var(--cyan)}
.bm-card h3{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;line-height:1.1;text-transform:uppercase;margin:0 4px;text-wrap:balance}
.bm-tick{display:block;width:22px;height:2px;border-radius:2px;background:var(--cyan);margin:6px auto}
.bm-card p{font-size:13px;color:var(--muted);margin:0 4px;line-height:1.4}
.bm-foot{text-align:center;color:var(--muted);font-size:12px;padding:10px 16px 28px}
`;
