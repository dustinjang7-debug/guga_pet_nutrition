import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
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

/**
 * Internal executor type — both the global drizzle handle and a per-request
 * transaction handle extend `PgDatabase`, which is the common base class
 * exposing the query API (select/insert/update/delete). Helpers accept this
 * union so they work seamlessly inside or outside a `withTransaction` block
 * without leaking the verbose `NodePgTransaction<TFullSchema, TSchema>`
 * generics into every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = PgDatabase<NodePgQueryResultHKT, any, any>;

/**
 * Run an async callback inside a single SQL transaction. We use this from
 * routers so a row mutation and the matching `recipe_activity` row are
 * committed atomically — partial failure can never leave the activity log
 * out of sync with the underlying recipe state.
 */
export async function withTransaction<T>(
  fn: (tx: Executor) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => fn(tx));
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
  const owned = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.updatedAt));
  const sharedRows = await db
    .select({ recipe: recipes, role: recipeCollaborators.role })
    .from(recipeCollaborators)
    .innerJoin(recipes, eq(recipeCollaborators.recipeId, recipes.id))
    .where(eq(recipeCollaborators.userId, userId))
    .orderBy(desc(recipes.updatedAt));
  const shared = sharedRows.map((r) => ({ ...r.recipe, role: r.role as "editor" | "viewer" }));
  const ownedTagged = owned.map((r) => ({ ...r, role: "owner" as const }));
  const seen = new Set<number>();
  const merged = [...ownedTagged, ...shared].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  merged.sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0));
  return merged;
}

export async function getRecipeRowById(id: number, executor?: Executor): Promise<Recipe | undefined> {
  const ex = executor ?? (await getDb());
  if (!ex) return undefined;
  const rows = await ex.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  return rows[0];
}

export async function createRecipe(input: InsertRecipe, executor?: Executor): Promise<Recipe> {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  const result = await ex.insert(recipes).values(input).returning();
  if (!result[0]) throw new Error("Failed to create recipe");
  return result[0];
}

export async function updateRecipeById(
  id: number,
  patch: Partial<InsertRecipe>,
  executor?: Executor,
): Promise<Recipe | undefined> {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  const result = await ex.update(recipes).set(patch).where(eq(recipes.id, id)).returning();
  return result[0];
}

/**
 * Compare-and-set update: only writes if the row's current `updatedAt`
 * matches `expectedUpdatedAt`. Returns the new row on success, `undefined`
 * if the precondition failed (i.e. someone else wrote concurrently). Pair
 * with the `recipes.update` router to detect stale writes atomically — the
 * pre-read + update window in the procedure is otherwise vulnerable to
 * concurrent writers both passing the precheck.
 */
export async function updateRecipeIfUnchanged(
  id: number,
  expectedUpdatedAt: Date,
  patch: Partial<InsertRecipe>,
  executor?: Executor,
): Promise<Recipe | undefined> {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  const result = await ex
    .update(recipes)
    .set(patch)
    .where(and(eq(recipes.id, id), eq(recipes.updatedAt, expectedUpdatedAt)))
    .returning();
  return result[0];
}

export async function deleteRecipeById(id: number, executor?: Executor) {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  await ex.delete(recipeCollaborators).where(eq(recipeCollaborators.recipeId, id));
  await ex.delete(recipeShareLinks).where(eq(recipeShareLinks.recipeId, id));
  await ex.delete(recipeActivity).where(eq(recipeActivity.recipeId, id));
  await ex.delete(recipes).where(eq(recipes.id, id));
}

// ----------------------------------------------------------------------------
// Activity log
// ----------------------------------------------------------------------------

export async function appendActivity(
  entry: {
    recipeId: number;
    actorUserId: number;
    action: RecipeActivity["action"];
    payload?: unknown;
  },
  executor?: Executor,
): Promise<void> {
  const ex = executor ?? (await getDb());
  if (!ex) return;
  await ex.insert(recipeActivity).values({
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

export async function upsertShareLink(
  input: { recipeId: number; token: string; createdByUserId: number },
  executor?: Executor,
) {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  const result = await ex
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

export async function disableShareLink(recipeId: number, executor?: Executor) {
  const ex = executor ?? (await getDb());
  if (!ex) return;
  await ex
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

export async function addOrUpdateCollaborator(
  input: {
    recipeId: number;
    userId: number;
    role: "viewer" | "editor";
    addedByUserId: number;
  },
  executor?: Executor,
): Promise<{ created: boolean }> {
  const ex = executor ?? (await getDb());
  if (!ex) throw new Error("Database not available");
  const existing = await ex
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
      await ex
        .update(recipeCollaborators)
        .set({ role: input.role })
        .where(eq(recipeCollaborators.id, existing[0].id));
    }
    return { created: false };
  }
  await ex.insert(recipeCollaborators).values({
    recipeId: input.recipeId,
    userId: input.userId,
    role: input.role,
    addedByUserId: input.addedByUserId,
  });
  return { created: true };
}

export async function removeCollaborator(recipeId: number, userId: number, executor?: Executor) {
  const ex = executor ?? (await getDb());
  if (!ex) return;
  await ex
    .delete(recipeCollaborators)
    .where(
      and(
        eq(recipeCollaborators.recipeId, recipeId),
        eq(recipeCollaborators.userId, userId),
      ),
    );
}

