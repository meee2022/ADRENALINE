/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountLookup from "../accountLookup.js";
import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as applySchedulePairs from "../applySchedulePairs.js";
import type * as attendance from "../attendance.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as banners from "../banners.js";
import type * as cleanupDuplicateMeals from "../cleanupDuplicateMeals.js";
import type * as coupons from "../coupons.js";
import type * as crons from "../crons.js";
import type * as customerAuth from "../customerAuth.js";
import type * as customerOrders from "../customerOrders.js";
import type * as customers from "../customers.js";
import type * as customizedLibraryHarvest from "../customizedLibraryHarvest.js";
import type * as customizedPlans from "../customizedPlans.js";
import type * as dailyPlans from "../dailyPlans.js";
import type * as delivery from "../delivery.js";
import type * as files from "../files.js";
import type * as fixPlanWording from "../fixPlanWording.js";
import type * as fixSchedule from "../fixSchedule.js";
import type * as fixScheduleExtra from "../fixScheduleExtra.js";
import type * as geo from "../geo.js";
import type * as gymSales from "../gymSales.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as inventorySetup from "../inventorySetup.js";
import type * as leaves from "../leaves.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_calories from "../lib/calories.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_phone from "../lib/phone.js";
import type * as loyalty from "../loyalty.js";
import type * as manager from "../manager.js";
import type * as mealCategories from "../mealCategories.js";
import type * as mealImages from "../mealImages.js";
import type * as mealIngredients from "../mealIngredients.js";
import type * as mealIssuances from "../mealIssuances.js";
import type * as mealNameFix from "../mealNameFix.js";
import type * as menuAlignment from "../menuAlignment.js";
import type * as menuDedupe from "../menuDedupe.js";
import type * as menuItems from "../menuItems.js";
import type * as modifiers from "../modifiers.js";
import type * as notifications from "../notifications.js";
import type * as onlineOrders from "../onlineOrders.js";
import type * as onlinePriceList from "../onlinePriceList.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwords from "../passwords.js";
import type * as payroll from "../payroll.js";
import type * as pos from "../pos.js";
import type * as posAdmin from "../posAdmin.js";
import type * as publicMeals from "../publicMeals.js";
import type * as publicPlans from "../publicPlans.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as rateLimit from "../rateLimit.js";
import type * as ratings from "../ratings.js";
import type * as resetTestData from "../resetTestData.js";
import type * as restaurantSettings from "../restaurantSettings.js";
import type * as seed from "../seed.js";
import type * as seedInventory from "../seedInventory.js";
import type * as seedMealSchedule from "../seedMealSchedule.js";
import type * as seedPublicWebsite from "../seedPublicWebsite.js";
import type * as seedRealPlans from "../seedRealPlans.js";
import type * as seedUsers from "../seedUsers.js";
import type * as sessions from "../sessions.js";
import type * as stickers from "../stickers.js";
import type * as storageCleanup from "../storageCleanup.js";
import type * as subscriptionPause from "../subscriptionPause.js";
import type * as units from "../units.js";
import type * as updateBanners from "../updateBanners.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountLookup: typeof accountLookup;
  ai: typeof ai;
  analytics: typeof analytics;
  applySchedulePairs: typeof applySchedulePairs;
  attendance: typeof attendance;
  auditLog: typeof auditLog;
  auth: typeof auth;
  banners: typeof banners;
  cleanupDuplicateMeals: typeof cleanupDuplicateMeals;
  coupons: typeof coupons;
  crons: typeof crons;
  customerAuth: typeof customerAuth;
  customerOrders: typeof customerOrders;
  customers: typeof customers;
  customizedLibraryHarvest: typeof customizedLibraryHarvest;
  customizedPlans: typeof customizedPlans;
  dailyPlans: typeof dailyPlans;
  delivery: typeof delivery;
  files: typeof files;
  fixPlanWording: typeof fixPlanWording;
  fixSchedule: typeof fixSchedule;
  fixScheduleExtra: typeof fixScheduleExtra;
  geo: typeof geo;
  gymSales: typeof gymSales;
  http: typeof http;
  inventory: typeof inventory;
  inventorySetup: typeof inventorySetup;
  leaves: typeof leaves;
  "lib/audit": typeof lib_audit;
  "lib/calories": typeof lib_calories;
  "lib/dates": typeof lib_dates;
  "lib/phone": typeof lib_phone;
  loyalty: typeof loyalty;
  manager: typeof manager;
  mealCategories: typeof mealCategories;
  mealImages: typeof mealImages;
  mealIngredients: typeof mealIngredients;
  mealIssuances: typeof mealIssuances;
  mealNameFix: typeof mealNameFix;
  menuAlignment: typeof menuAlignment;
  menuDedupe: typeof menuDedupe;
  menuItems: typeof menuItems;
  modifiers: typeof modifiers;
  notifications: typeof notifications;
  onlineOrders: typeof onlineOrders;
  onlinePriceList: typeof onlinePriceList;
  passwordReset: typeof passwordReset;
  passwords: typeof passwords;
  payroll: typeof payroll;
  pos: typeof pos;
  posAdmin: typeof posAdmin;
  publicMeals: typeof publicMeals;
  publicPlans: typeof publicPlans;
  purchaseOrders: typeof purchaseOrders;
  rateLimit: typeof rateLimit;
  ratings: typeof ratings;
  resetTestData: typeof resetTestData;
  restaurantSettings: typeof restaurantSettings;
  seed: typeof seed;
  seedInventory: typeof seedInventory;
  seedMealSchedule: typeof seedMealSchedule;
  seedPublicWebsite: typeof seedPublicWebsite;
  seedRealPlans: typeof seedRealPlans;
  seedUsers: typeof seedUsers;
  sessions: typeof sessions;
  stickers: typeof stickers;
  storageCleanup: typeof storageCleanup;
  subscriptionPause: typeof subscriptionPause;
  units: typeof units;
  updateBanners: typeof updateBanners;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
