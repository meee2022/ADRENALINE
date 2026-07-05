/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as applySchedulePairs from "../applySchedulePairs.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as banners from "../banners.js";
import type * as cleanupDuplicateMeals from "../cleanupDuplicateMeals.js";
import type * as coupons from "../coupons.js";
import type * as customerAuth from "../customerAuth.js";
import type * as customerOrders from "../customerOrders.js";
import type * as customers from "../customers.js";
import type * as dailyPlans from "../dailyPlans.js";
import type * as files from "../files.js";
import type * as fixPlanWording from "../fixPlanWording.js";
import type * as fixSchedule from "../fixSchedule.js";
import type * as fixScheduleExtra from "../fixScheduleExtra.js";
import type * as geo from "../geo.js";
import type * as inventory from "../inventory.js";
import type * as mealCategories from "../mealCategories.js";
import type * as mealImages from "../mealImages.js";
import type * as mealIngredients from "../mealIngredients.js";
import type * as menuItems from "../menuItems.js";
import type * as modifiers from "../modifiers.js";
import type * as notifications from "../notifications.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwords from "../passwords.js";
import type * as payroll from "../payroll.js";
import type * as publicMeals from "../publicMeals.js";
import type * as publicPlans from "../publicPlans.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as ratings from "../ratings.js";
import type * as restaurantSettings from "../restaurantSettings.js";
import type * as seed from "../seed.js";
import type * as seedInventory from "../seedInventory.js";
import type * as seedMealSchedule from "../seedMealSchedule.js";
import type * as seedPublicWebsite from "../seedPublicWebsite.js";
import type * as seedRealPlans from "../seedRealPlans.js";
import type * as seedUsers from "../seedUsers.js";
import type * as sessions from "../sessions.js";
import type * as stickers from "../stickers.js";
import type * as units from "../units.js";
import type * as updateBanners from "../updateBanners.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  applySchedulePairs: typeof applySchedulePairs;
  auditLog: typeof auditLog;
  auth: typeof auth;
  banners: typeof banners;
  cleanupDuplicateMeals: typeof cleanupDuplicateMeals;
  coupons: typeof coupons;
  customerAuth: typeof customerAuth;
  customerOrders: typeof customerOrders;
  customers: typeof customers;
  dailyPlans: typeof dailyPlans;
  files: typeof files;
  fixPlanWording: typeof fixPlanWording;
  fixSchedule: typeof fixSchedule;
  fixScheduleExtra: typeof fixScheduleExtra;
  geo: typeof geo;
  inventory: typeof inventory;
  mealCategories: typeof mealCategories;
  mealImages: typeof mealImages;
  mealIngredients: typeof mealIngredients;
  menuItems: typeof menuItems;
  modifiers: typeof modifiers;
  notifications: typeof notifications;
  passwordReset: typeof passwordReset;
  passwords: typeof passwords;
  payroll: typeof payroll;
  publicMeals: typeof publicMeals;
  publicPlans: typeof publicPlans;
  purchaseOrders: typeof purchaseOrders;
  ratings: typeof ratings;
  restaurantSettings: typeof restaurantSettings;
  seed: typeof seed;
  seedInventory: typeof seedInventory;
  seedMealSchedule: typeof seedMealSchedule;
  seedPublicWebsite: typeof seedPublicWebsite;
  seedRealPlans: typeof seedRealPlans;
  seedUsers: typeof seedUsers;
  sessions: typeof sessions;
  stickers: typeof stickers;
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
