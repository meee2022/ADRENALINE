import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validated = schema.insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validated);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create customer" });
      }
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = schema.insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, validated);
      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update customer" });
      }
    }
  });

  // Meal Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getMealCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validated = schema.insertMealCategorySchema.parse(req.body);
      const category = await storage.createMealCategory(validated);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create category" });
      }
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = schema.insertMealCategorySchema.partial().parse(req.body);
      const category = await storage.updateMealCategory(id, validated);
      if (!category) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update category" });
      }
    }
  });

  app.post("/api/categories/reorder", async (req, res) => {
    try {
      const schema_reorder = z.array(z.object({
        id: z.string(),
        sortOrder: z.number()
      }));
      const validated = schema_reorder.parse(req.body);
      await storage.reorderMealCategories(validated);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to reorder categories" });
      }
    }
  });

  // Menu Items
  app.get("/api/menu-items", async (req, res) => {
    try {
      const items = await storage.getMenuItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  app.post("/api/menu-items", async (req, res) => {
    try {
      const validated = schema.insertMenuItemSchema.parse(req.body);
      const item = await storage.createMenuItem(validated);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create menu item" });
      }
    }
  });

  app.patch("/api/menu-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = schema.insertMenuItemSchema.partial().parse(req.body);
      const item = await storage.updateMenuItem(id, validated);
      if (!item) {
        res.status(404).json({ error: "Menu item not found" });
        return;
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update menu item" });
      }
    }
  });

  // Addons
  app.get("/api/addons", async (req, res) => {
    try {
      const addons = await storage.getAddons();
      res.json(addons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch addons" });
    }
  });

  app.post("/api/addons", async (req, res) => {
    try {
      const validated = schema.insertAddonSchema.parse(req.body);
      const addon = await storage.createAddon(validated);
      res.json(addon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create addon" });
      }
    }
  });

  app.patch("/api/addons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = schema.insertAddonSchema.partial().parse(req.body);
      const addon = await storage.updateAddon(id, validated);
      if (!addon) {
        res.status(404).json({ error: "Addon not found" });
        return;
      }
      res.json(addon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update addon" });
      }
    }
  });

  // Daily Plans
  app.get("/api/daily-plans", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const plans = await storage.getDailyPlans(date);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily plans" });
    }
  });

  app.post("/api/daily-plans", async (req, res) => {
    try {
      const validated = schema.insertDailyPlanSchema.parse(req.body);
      const plan = await storage.createDailyPlan(validated);
      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create daily plan" });
      }
    }
  });

  app.patch("/api/daily-plans/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = schema.insertDailyPlanSchema.partial().parse(req.body);
      const plan = await storage.updateDailyPlan(id, validated);
      if (!plan) {
        res.status(404).json({ error: "Daily plan not found" });
        return;
      }
      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update daily plan" });
      }
    }
  });

  return httpServer;
}
