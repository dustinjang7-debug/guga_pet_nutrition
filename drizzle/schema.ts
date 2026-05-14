import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const speciesEnum = pgEnum("species", ["dog", "cat"]);
export const feedingModeEnum = pgEnum("feeding_mode", ["normal", "weight_loss"]);
export const workflowEnum = pgEnum("workflow", ["wizard", "simple", "premix"]);
export const recipeStatusEnum = pgEnum("recipe_status", ["draft", "approved"]);
export const collaboratorRoleEnum = pgEnum("collaborator_role", ["editor", "viewer"]);
export const recipeActivityActionEnum = pgEnum("recipe_activity_action", [
  "created",
  "edited",
  "status_changed",
  "shared",
  "link_rotated",
  "link_disabled",
  "collaborator_added",
  "collaborator_role_changed",
  "collaborator_removed",
  "imported_from_pdf",
  "imported_from_file",
  "duplicated",
]);

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
 */
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // FK -> users.id (owner)
  name: varchar("name", { length: 200 }).notNull(),
  petName: varchar("petName", { length: 100 }),
  petId: varchar("petId", { length: 64 }),
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
  /** Last user that wrote this recipe (owner or editor); null for legacy rows. */
  updatedByUserId: integer("updatedByUserId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

/**
 * People other than the owner who can view or edit a recipe.
 * The owner is implicit (recipes.userId) and is never written here.
 */
export const recipeCollaborators = pgTable(
  "recipe_collaborators",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipeId").notNull(),
    userId: integer("userId").notNull(),
    role: collaboratorRoleEnum("role").notNull(),
    addedAt: timestamp("addedAt", { withTimezone: true }).defaultNow().notNull(),
    addedByUserId: integer("addedByUserId").notNull(),
  },
  (t) => ({
    recipeUserUnique: uniqueIndex("recipe_collaborators_recipe_user_unique").on(
      t.recipeId,
      t.userId,
    ),
  }),
);

export type RecipeCollaborator = typeof recipeCollaborators.$inferSelect;

/**
 * One active share link per recipe. Rotating the link replaces the token.
 */
export const recipeShareLinks = pgTable("recipe_share_links", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull().unique(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  /**
   * Role granted to anyone who joins via this link. Today the UI only
   * exposes "viewer" (matching the original product spec — the owner can
   * promote later via setRole), but the column is wired through so a
   * future "send-as-editor" link doesn't require a schema change.
   */
  defaultRole: collaboratorRoleEnum("defaultRole").default("viewer").notNull(),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revokedAt", { withTimezone: true }),
});

export type RecipeShareLink = typeof recipeShareLinks.$inferSelect;

/**
 * Append-only activity log per recipe. Written inside the same DB call as
 * the change it describes so the log can never disagree with the data.
 */
export const recipeActivity = pgTable("recipe_activity", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(),
  actorUserId: integer("actorUserId").notNull(),
  action: recipeActivityActionEnum("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type RecipeActivity = typeof recipeActivity.$inferSelect;

/**
 * Per-user "I've seen activity up to here" pointer for a recipe. Powers the
 * unread-activity badge on /home and is updated whenever the user opens the
 * recipe builder or the History panel for a recipe.
 *
 * Uniqueness is enforced by a `(userId, recipeId)` unique index — at most
 * one pointer per pair, which is what `markRecipeActivitySeen`'s upsert
 * relies on. Stored as a timestamp instead of an activity id so we don't
 * need a foreign key on an append-only log; comparing against
 * `recipe_activity.createdAt` is cheap and resilient to log pruning.
 */
export const recipeActivitySeen = pgTable(
  "recipe_activity_seen",
  {
    userId: integer("userId").notNull(),
    recipeId: integer("recipeId").notNull(),
    lastSeenAt: timestamp("lastSeenAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userRecipeUnique: uniqueIndex("recipe_activity_seen_user_recipe_unique").on(
      t.userId,
      t.recipeId,
    ),
  }),
);

export type RecipeActivitySeen = typeof recipeActivitySeen.$inferSelect;
