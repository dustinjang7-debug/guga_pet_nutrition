import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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
export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK -> users.id
  name: varchar("name", { length: 200 }).notNull(),
  petName: varchar("petName", { length: 100 }),
  petId: varchar("petId", { length: 64 }), // free-text client/owner ID
  species: mysqlEnum("species", ["dog", "cat"]).notNull(),
  lifeStage: varchar("lifeStage", { length: 64 }).notNull(),
  bodyWeightKg: decimal("bodyWeightKg", { precision: 6, scale: 2 }).notNull(),
  lifeStageFactor: decimal("lifeStageFactor", { precision: 4, scale: 2 }).notNull(),
  feedingMode: mysqlEnum("feedingMode", ["normal", "weight_loss"]).default("normal").notNull(),
  workflow: mysqlEnum("workflow", ["wizard", "simple", "premix"]).default("simple").notNull(),
  startingVolumeG: int("startingVolumeG").default(1000).notNull(),
  targetProteinPct: decimal("targetProteinPct", { precision: 5, scale: 2 }),
  targetCarbPct: decimal("targetCarbPct", { precision: 5, scale: 2 }),
  /** JSON array of { ingredientId, grams }. */
  items: json("items").notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["draft", "approved"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;
