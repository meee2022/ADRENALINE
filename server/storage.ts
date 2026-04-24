import { eq, and } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;

  // Customers
  getCustomers(): Promise<schema.Customer[]>;
  getCustomer(id: string): Promise<schema.Customer | undefined>;
  createCustomer(customer: schema.InsertCustomer): Promise<schema.Customer>;
  updateCustomer(id: string, customer: Partial<schema.InsertCustomer>): Promise<schema.Customer | undefined>;

  // Meal Categories
  getMealCategories(): Promise<schema.MealCategory[]>;
  getMealCategory(id: string): Promise<schema.MealCategory | undefined>;
  createMealCategory(category: schema.InsertMealCategory): Promise<schema.MealCategory>;
  updateMealCategory(id: string, category: Partial<schema.InsertMealCategory>): Promise<schema.MealCategory | undefined>;
  reorderMealCategories(categories: Array<{ id: string; sortOrder: number }>): Promise<void>;

  // Menu Items
  getMenuItems(): Promise<schema.MenuItem[]>;
  getMenuItem(id: string): Promise<schema.MenuItem | undefined>;
  createMenuItem(item: schema.InsertMenuItem): Promise<schema.MenuItem>;
  updateMenuItem(id: string, item: Partial<schema.InsertMenuItem>): Promise<schema.MenuItem | undefined>;

  // Addons
  getAddons(): Promise<schema.Addon[]>;
  getAddon(id: string): Promise<schema.Addon | undefined>;
  createAddon(addon: schema.InsertAddon): Promise<schema.Addon>;
  updateAddon(id: string, addon: Partial<schema.InsertAddon>): Promise<schema.Addon | undefined>;

  // Daily Plans
  getDailyPlans(date?: string): Promise<schema.DailyPlan[]>;
  getDailyPlan(id: string): Promise<schema.DailyPlan | undefined>;
  createDailyPlan(plan: schema.InsertDailyPlan): Promise<schema.DailyPlan>;
  updateDailyPlan(id: string, plan: Partial<schema.InsertDailyPlan>): Promise<schema.DailyPlan | undefined>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [newUser] = await db.insert(schema.users).values(user).returning();
    return newUser;
  }

  // Customers
  async getCustomers(): Promise<schema.Customer[]> {
    return db.select().from(schema.customers).orderBy(schema.customers.createdAt);
  }

  async getCustomer(id: string): Promise<schema.Customer | undefined> {
    const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
    return customer;
  }

  async createCustomer(customer: schema.InsertCustomer): Promise<schema.Customer> {
    const [newCustomer] = await db.insert(schema.customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<schema.InsertCustomer>): Promise<schema.Customer | undefined> {
    const [updated] = await db.update(schema.customers).set(customer).where(eq(schema.customers.id, id)).returning();
    return updated;
  }

  // Meal Categories
  async getMealCategories(): Promise<schema.MealCategory[]> {
    return db.select().from(schema.mealCategories).orderBy(schema.mealCategories.sortOrder);
  }

  async getMealCategory(id: string): Promise<schema.MealCategory | undefined> {
    const [category] = await db.select().from(schema.mealCategories).where(eq(schema.mealCategories.id, id));
    return category;
  }

  async createMealCategory(category: schema.InsertMealCategory): Promise<schema.MealCategory> {
    const [newCategory] = await db.insert(schema.mealCategories).values(category).returning();
    return newCategory;
  }

  async updateMealCategory(id: string, category: Partial<schema.InsertMealCategory>): Promise<schema.MealCategory | undefined> {
    const [updated] = await db.update(schema.mealCategories).set(category).where(eq(schema.mealCategories.id, id)).returning();
    return updated;
  }

  async reorderMealCategories(categories: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await db.transaction(async (tx) => {
      for (const cat of categories) {
        await tx.update(schema.mealCategories).set({ sortOrder: cat.sortOrder }).where(eq(schema.mealCategories.id, cat.id));
      }
    });
  }

  // Menu Items
  async getMenuItems(): Promise<schema.MenuItem[]> {
    return db.select().from(schema.menuItems);
  }

  async getMenuItem(id: string): Promise<schema.MenuItem | undefined> {
    const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id));
    return item;
  }

  async createMenuItem(item: schema.InsertMenuItem): Promise<schema.MenuItem> {
    const [newItem] = await db.insert(schema.menuItems).values(item).returning();
    return newItem;
  }

  async updateMenuItem(id: string, item: Partial<schema.InsertMenuItem>): Promise<schema.MenuItem | undefined> {
    const [updated] = await db.update(schema.menuItems).set(item).where(eq(schema.menuItems.id, id)).returning();
    return updated;
  }

  // Addons
  async getAddons(): Promise<schema.Addon[]> {
    return db.select().from(schema.addons);
  }

  async getAddon(id: string): Promise<schema.Addon | undefined> {
    const [addon] = await db.select().from(schema.addons).where(eq(schema.addons.id, id));
    return addon;
  }

  async createAddon(addon: schema.InsertAddon): Promise<schema.Addon> {
    const [newAddon] = await db.insert(schema.addons).values(addon).returning();
    return newAddon;
  }

  async updateAddon(id: string, addon: Partial<schema.InsertAddon>): Promise<schema.Addon | undefined> {
    const [updated] = await db.update(schema.addons).set(addon).where(eq(schema.addons.id, id)).returning();
    return updated;
  }

  // Daily Plans
  async getDailyPlans(date?: string): Promise<schema.DailyPlan[]> {
    if (date) {
      return db.select().from(schema.dailyPlans).where(eq(schema.dailyPlans.date, date));
    }
    return db.select().from(schema.dailyPlans);
  }

  async getDailyPlan(id: string): Promise<schema.DailyPlan | undefined> {
    const [plan] = await db.select().from(schema.dailyPlans).where(eq(schema.dailyPlans.id, id));
    return plan;
  }

  async createDailyPlan(plan: schema.InsertDailyPlan): Promise<schema.DailyPlan> {
    const [newPlan] = await db.insert(schema.dailyPlans).values(plan).returning();
    return newPlan;
  }

  async updateDailyPlan(id: string, plan: Partial<schema.InsertDailyPlan>): Promise<schema.DailyPlan | undefined> {
    const [updated] = await db.update(schema.dailyPlans).set(plan).where(eq(schema.dailyPlans.id, id)).returning();
    return updated;
  }
}

export const storage = new DbStorage();
