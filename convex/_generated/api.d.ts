/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as banners from "../banners.js";
import type * as customerAuth from "../customerAuth.js";
import type * as customerOrders from "../customerOrders.js";
import type * as customers from "../customers.js";
import type * as dailyPlans from "../dailyPlans.js";
import type * as files from "../files.js";
import type * as inventory from "../inventory.js";
import type * as mealCategories from "../mealCategories.js";
import type * as menuItems from "../menuItems.js";
import type * as modifiers from "../modifiers.js";
import type * as publicMeals from "../publicMeals.js";
import type * as publicPlans from "../publicPlans.js";
import type * as restaurantSettings from "../restaurantSettings.js";
import type * as seed from "../seed.js";
import type * as seedInventory from "../seedInventory.js";
import type * as seedPublicWebsite from "../seedPublicWebsite.js";
import type * as seedRealPlans from "../seedRealPlans.js";
import type * as seedUsers from "../seedUsers.js";
import type * as stickers from "../stickers.js";
import type * as updateBanners from "../updateBanners.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  banners: typeof banners;
  customerAuth: typeof customerAuth;
  customerOrders: typeof customerOrders;
  customers: typeof customers;
  dailyPlans: typeof dailyPlans;
  files: typeof files;
  inventory: typeof inventory;
  mealCategories: typeof mealCategories;
  menuItems: typeof menuItems;
  modifiers: typeof modifiers;
  publicMeals: typeof publicMeals;
  publicPlans: typeof publicPlans;
  restaurantSettings: typeof restaurantSettings;
  seed: typeof seed;
  seedInventory: typeof seedInventory;
  seedPublicWebsite: typeof seedPublicWebsite;
  seedRealPlans: typeof seedRealPlans;
  seedUsers: typeof seedUsers;
  stickers: typeof stickers;
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
