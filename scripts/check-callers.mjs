import fs from "fs";
import path from "path";
process.chdir("C:/Users/M/Desktop/github for local/adrenaline-last");

const FNS = [
  "restaurantSettings.update", "restaurantSettings.updateHeroLogo", "restaurantSettings.deleteHeroLogo", "restaurantSettings.initializeDefault",
  "files.generateUploadUrl", "files.getFileUrl",
  "auditLog.list", "auditLog.stats",
  "analytics.overview", "analytics.salesLast30Days", "analytics.orderStatusDistribution", "analytics.topMeals", "analytics.customerGrowth", "analytics.kitchenPerformance",
  "notifications.listForRole", "notifications.unreadCount", "notifications.markAsRead", "notifications.markAllAsRead",
  "publicPlans.create", "publicPlans.update", "publicPlans.remove",
  "menuItems.list", "menuItems.create", "menuItems.update", "menuItems.remove", "menuItems.syncFromPublicMeals",
  "mealCategories.list", "mealCategories.create", "mealCategories.update", "mealCategories.reorder", "mealCategories.remove",
  "modifiers.list", "modifiers.create", "modifiers.update", "modifiers.remove",
  "mealIngredients.listByMeal", "mealIngredients.create", "mealIngredients.remove",
  "banners.list", "banners.create", "banners.remove", "banners.toggleActive",
  "publicMeals.create", "publicMeals.update", "publicMeals.remove",
  "stickers.get",
  "purchaseOrders.list", "purchaseOrders.generateFromLowStock", "purchaseOrders.updateStatus", "purchaseOrders.remove",
  "coupons.list", "seedInventory.seedInventoryData",
];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|_generated/.test(p)) walk(p); }
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})("client/src");

const bad = [];
for (const f of files) {
  const L = fs.readFileSync(f, "utf8").split(/\r?\n/);
  L.forEach((l, i) => {
    for (const fn of FNS) {
      // حدّ كلمة: "banners.list" يجب ألا يطابق "banners.listActiveBanners" (وهي دالة عامة)
      const re = new RegExp("api\\." + fn.replace(/\./g, "\\.") + "(?![A-Za-z0-9_])");
      if (!re.test(l)) continue;
      if (/useConvexMutation\(|useMutation\(/.test(l)) continue; // declaration only
      const win = L.slice(i, i + 14).join("\n");
      if (!/sessionToken/.test(win)) {
        bad.push(f.split(path.sep).join("/") + ":" + (i + 1) + "  " + l.trim().slice(0, 62));
      }
    }
  });
}
console.log(bad.length ? "MISSING TOKEN:\n" + bad.join("\n") : "OK: every wave-2 call site passes sessionToken");
