// html2pdf.js لا يوفّر أنواعاً — نعرّفه كـ any (نستخدمه ديناميكياً في kitchenSheet.ts).
declare module "html2pdf.js" {
  const html2pdf: any;
  export default html2pdf;
}
