import { integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const speciesEnum = pgEnum("species", ["dog", "cat"]);
export const feedingModeEnum = pgEnum("feeding_mode", ["normal", "weight_loss"]);
export const workflowEnum = pgEnum("workflow", ["wizard", "simple", "premix"]);
export const recipeStatusEnum = pgEnum("recipe_status", ["draft", "approved"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Recipe records owned by a user. Each recipe captures the pet profile,
 * the macro targets, the workflow used, and the list of ingredients (as JSON).
 *
 * We keep ingredient-list inside `items` JSON instead of a separate table for
 * three reasons: ingredients are tightly coupled to the recipe, we never query
 * across recipes by ingredient, and JSON keeps the schema simple.
 */
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // FK -> users.id
  name: varchar("name", { length: 200 }).notNull(),
  petName: varchar("petName", { length: 100 }),
  petId: varchar("petId", { length: 64 }), // free-text client/owner ID
  species: speciesEnum("species").notNull(),
  lifeStage: varchar("lifeStage", { length: 64 }).notNull(),
  bodyWeightKg: numeric("bodyWeightKg", { precision: 6, scale: 2 }).notNull(),
  lifeStageFactor: numeric("lifeStageFactor", { precision: 4, scale: 2 }).notNull(),
  feedingMode: feedingModeEnum("feedingMode").default("normal").notNull(),
  workflow: workflowEnum("workflow").default("simple").notNull(),
  startingVolumeG: integer("startingVolumeG").default(1000).notNull(),
  targetProteinPct: numeric("targetProteinPct", { precision: 5, scale: 2 }),
  targetCarbPct: numeric("targetCarbPct", { precision: 5, scale: 2 }),
  /** JSON array of { ingredientId, grams }. */
  items: jsonb("items").notNull(),
  notes: text("notes"),
  status: recipeStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;
