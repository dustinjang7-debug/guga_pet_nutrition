/**
 * Centralized authorization for recipe operations.
 *
 * - `owner`   : the user that originally created the recipe (recipes.userId)
 * - `editor`  : a collaborator with role=editor
 * - `viewer`  : a collaborator with role=viewer
 * - `null`    : no access
 *
 * All recipe-touching tRPC procedures should call `getRecipeAccess` and gate
 * on the returned role. Owner-only operations are share/delete; write
 * requires owner-or-editor; read requires any non-null role.
 */

import { and, eq } from "drizzle-orm";
import { recipeCollaborators, recipes, type Recipe } from "../drizzle/schema";
import { getDb } from "./db";

export type RecipeRole = "owner" | "editor" | "viewer";

export interface RecipeAccess {
  role: RecipeRole | null;
  recipe: Recipe | null;
}

export async function getRecipeAccess(recipeId: number, userId: number): Promise<RecipeAccess> {
  const db = await getDb();
  if (!db) return { role: null, recipe: null };
  const rows = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  const recipe = rows[0];
  if (!recipe) return { role: null, recipe: null };
  if (recipe.userId === userId) return { role: "owner", recipe };
  const collab = await db
    .select()
    .from(recipeCollaborators)
    .where(and(eq(recipeCollaborators.recipeId, recipeId), eq(recipeCollaborators.userId, userId)))
    .limit(1);
  if (collab[0]) return { role: collab[0].role as "editor" | "viewer", recipe };
  return { role: null, recipe };
}

export function canWrite(role: RecipeRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageSharing(role: RecipeRole | null): boolean {
  return role === "owner";
}
