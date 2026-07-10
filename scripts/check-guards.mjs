import fs from "fs";
process.chdir("C:/Users/M/Desktop/github for local/adrenaline-last");

const T = {
  "restaurantSettings.ts": ["update", "updateHeroLogo", "deleteHeroLogo", "initializeDefault"],
  "files.ts": ["generateUploadUrl", "getFileUrl"],
  "auditLog.ts": ["list", "stats"],
  "analytics.ts": ["overview", "salesLast30Days", "orderStatusDistribution", "topMeals", "customerGrowth", "kitchenPerformance"],
  "notifications.ts": ["listForRole", "unreadCount", "markAsRead", "markAllAsRead"],
  "publicPlans.ts": ["create", "update", "remove"],
  "menuItems.ts": ["list", "create", "update", "remove", "syncFromPublicMeals"],
  "mealCategories.ts": ["list", "create", "update", "reorder", "remove"],
  "modifiers.ts": ["list", "create", "update", "remove"],
  "mealIngredients.ts": ["listByMeal", "listAll", "create", "update", "remove"],
  "banners.ts": ["list", "create", "remove", "toggleActive"],
  "publicMeals.ts": ["create", "update", "remove"],
  "stickers.ts": ["get"],
  "purchaseOrders.ts": ["list", "generateFromLowStock", "create", "updateStatus", "remove"],
  "coupons.ts": ["list"],
  "seedInventory.ts": ["seedInventoryData"],
};

const bad = [];
let n = 0;
for (const [file, fns] of Object.entries(T)) {
  const s = fs.readFileSync("convex/" + file, "utf8");
  for (const fn of fns) {
    n++;
    const re = new RegExp("export const " + fn + " = (query|mutation)\\(\\{");
    const m = s.match(re);
    if (!m) { bad.push(file + ":" + fn + " NOT FOUND"); continue; }
    const start = s.indexOf(m[0]);
    // end of this function = next "export const" or EOF
    const nextExport = s.indexOf("export const ", start + 10);
    const body = s.slice(start, nextExport < 0 ? s.length : nextExport);

    const hasArg = /sessionToken: v\.optional/.test(body);
    // first executable statement after "=> {"
    const bIdx = body.indexOf("=> {");
    const after = body.slice(bIdx + 4);
    const first = after.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))[0] || "";
    const guardFirst = /^await require(Staff|Admin)\(/.test(first);

    if (!hasArg || !guardFirst) {
      bad.push(`${file}:${fn}  arg=${hasArg} guardFirst=${guardFirst}  first="${first.slice(0, 55)}"`);
    }
  }
}
console.log(bad.length ? "PROBLEMS (" + bad.length + "/" + n + "):\n" + bad.join("\n") : `OK: all ${n} functions have sessionToken + guard as FIRST statement`);
