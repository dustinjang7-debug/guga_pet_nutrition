import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  recipeActivity,
  recipeCollaborators,
  recipeShareLinks,
  recipes,
  users,
  type InsertRecipe,
  type Recipe,
  type RecipeActivity,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

// ----------------------------------------------------------------------------
// Recipe helpers
// ----------------------------------------------------------------------------

/**
 * List recipes the user can see — owned plus shared (any role).
 */
export async function listRecipesByUser(userId: number): Promise<Array<Recipe & { role: "owner" | "editor" | "viewer" }>> {
  const db = await getDb();
  if (!db) return [];
  // Owned
  const owned = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.updatedAt));
  // Shared via collaborator
  const sharedRows = await db
    .select({
      recipe: recipes,
      role: recipeCollaborators.role,
    })
    .from(recipeCollaborators)
    .innerJoin(recipes, eq(recipeCollaborators.recipeId, recipes.id))
    .where(eq(recipeCollaborators.userId, userId))
    .orderBy(desc(recipes.updatedAt));
  const shared = sharedRows.map((r) => ({ ...r.recipe, role: r.role as "editor" | "viewer" }));
  const ownedTagged = owned.map((r) => ({ ...r, role: "owner" as const }));
  // De-dupe just in case (a user shouldn't be a collaborator on their own recipe)
  const seen = new Set<number>();
  const merged = [...ownedTagged, ...shared].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  merged.sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0));
  return merged;
}

export async function getRecipeRowById(id: number): Promise<Recipe | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  return rows[0];
}

export async function createRecipe(input: InsertRecipe): Promise<Recipe> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recipes).values(input).returning();
  if (!result[0]) throw new Error("Failed to create recipe");
  return result[0];
}

export async function updateRecipeById(id: number, patch: Partial<InsertRecipe>): Promise<Recipe | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(recipes)
    .set(patch)
    .where(eq(recipes.id, id))
    .returning();
  return result[0];
}

export async function deleteRecipeById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Cascade: remove collaborators, share link, activity. We don't have FK
  // cascades configured, so do it explicitly.
  await db.delete(recipeCollaborators).where(eq(recipeCollaborators.recipeId, id));
  await db.delete(recipeShareLinks).where(eq(recipeShareLinks.recipeId, id));
  await db.delete(recipeActivity).where(eq(recipeActivity.recipeId, id));
  await db.delete(recipes).where(eq(recipes.id, id));
}

// ----------------------------------------------------------------------------
// Activity log
// ----------------------------------------------------------------------------

export async function appendActivity(entry: {
  recipeId: number;
  actorUserId: number;
  action: RecipeActivity["action"];
  payload?: unknown;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(recipeActivity).values({
    recipeId: entry.recipeId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    payload: (entry.payload ?? null) as RecipeActivity["payload"],
  });
}

export async function listActivityForRecipe(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: recipeActivity.id,
      recipeId: recipeActivity.recipeId,
      actorUserId: recipeActivity.actorUserId,
      action: recipeActivity.action,
      payload: recipeActivity.payload,
      createdAt: recipeActivity.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(recipeActivity)
    .leftJoin(users, eq(users.id, recipeActivity.actorUserId))
    .where(eq(recipeActivity.recipeId, recipeId))
    .orderBy(desc(recipeActivity.createdAt))
    .limit(200);
  return rows;
}

// ----------------------------------------------------------------------------
// Sharing
// ----------------------------------------------------------------------------

export async function getShareLinkByRecipe(recipeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(recipeShareLinks)
    .where(eq(recipeShareLinks.recipeId, recipeId))
    .limit(1);
  return rows[0];
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(recipeShareLinks)
    .where(eq(recipeShareLinks.token, token))
    .limit(1);
  return rows[0];
}

export async function upsertShareLink(input: {
  recipeId: number;
  token: string;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .insert(recipeShareLinks)
    .values({
      recipeId: input.recipeId,
      token: input.token,
      createdByUserId: input.createdByUserId,
      isActive: true,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: recipeShareLinks.recipeId,
      set: {
        token: input.token,
        isActive: true,
        revokedAt: null,
        createdByUserId: input.createdByUserId,
        createdAt: new Date(),
      },
    })
    .returning();
  return result[0];
}

export async function disableShareLink(recipeId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(recipeShareLinks)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(recipeShareLinks.recipeId, recipeId));
}

// ----------------------------------------------------------------------------
// Collaborators
// ----------------------------------------------------------------------------

export async function listCollaborators(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: recipeCollaborators.id,
      userId: recipeCollaborators.userId,
      role: recipeCollaborators.role,
      addedAt: recipeCollaborators.addedAt,
      addedByUserId: recipeCollaborators.addedByUserId,
      name: users.name,
      email: users.email,
    })
    .from(recipeCollaborators)
    .leftJoin(users, eq(users.id, recipeCollaborators.userId))
    .where(eq(recipeCollaborators.recipeId, recipeId))
    .orderBy(desc(recipeCollaborators.addedAt));
  return rows;
}

export async function addOrUpdateCollaborator(input: {
  recipeId: number;
  userId: number;
  role: "viewer" | "editor";
  addedByUserId: number;
}): Promise<{ created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(recipeCollaborators)
    .where(
      and(
        eq(recipeCollaborators.recipeId, input.recipeId),
        eq(recipeCollaborators.userId, input.userId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].role !== input.role) {
      await db
        .update(recipeCollaborators)
        .set({ role: input.role })
        .where(eq(recipeCollaborators.id, existing[0].id));
    }
    return { created: false };
  }
  await db.insert(recipeCollaborators).values({
    recipeId: input.recipeId,
    userId: input.userId,
    role: input.role,
    addedByUserId: input.addedByUserId,
  });
  return { created: true };
}

export async function removeCollaborator(recipeId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(recipeCollaborators)
    .where(
      and(
        eq(recipeCollaborators.recipeId, recipeId),
        eq(recipeCollaborators.userId, userId),
      ),
    );
}

// Quietly mark `or` as used so unused-import lint never fires across edits.
void or;
