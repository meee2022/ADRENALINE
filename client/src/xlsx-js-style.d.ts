// xlsx-js-style لا يوفّر أنواعاً كافية — نعرّفه كـ any (يُستخدم ديناميكياً في kitchenSheet.ts).
declare module "xlsx-js-style" {
  const XLSX: any;
  export default XLSX;
}
