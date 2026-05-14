import { COOKIE_NAME } from "@shared/const";
import { portableRecipeSchema } from "@shared/recipeFile";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addOrUpdateCollaborator,
  appendActivity,
  createRecipe,
  deleteRecipeById,
  disableShareLink,
  getRecipeRowById,
  getShareLinkByRecipe,
  getShareLinkByToken,
  getUserById,
  listActivityForRecipe,
  listCollaborators,
  listRecipesByUser,
  markRecipeActivitySeen,
  removeCollaborator,
  updateRecipeById,
  updateRecipeIfUnchanged,
  upsertShareLink,
  withTransaction,
} from "./db";
import { generateRecipePdf } from "./pdfExport";
import { canManageSharing, canWrite, getRecipeAccess } from "./recipeAccess";
import { diffRecipes, isEmptyDiff } from "./recipeDiff";
import { ImportError, parseRecipeImport } from "./recipeImport";

const recipeItemSchema = z.object({
  ingredientId: z.number().int().positive(),
  grams: z.number().nonnegative(),
});

const recipeInputSchema = z.object({
  name: z.string().min(1).max(200),
  petName: z.string().max(100).nullish(),
  petId: z.string().max(64).nullish(),
  species: z.enum(["dog", "cat"]),
  lifeStage: z.string().max(64),
  bodyWeightKg: z.number().positive().max(200),
  lifeStageFactor: z.number().positive().max(10),
  feedingMode: z.enum(["normal", "weight_loss"]).default("normal"),
  workflow: z.enum(["wizard", "simple", "premix"]).default("simple"),
  startingVolumeG: z.number().int().positive().max(100000).default(1000),
  targetProteinPct: z.number().min(0).max(100).nullish(),
  targetCarbPct: z.number().min(0).max(100).nullish(),
  items: z.array(recipeItemSchema),
  notes: z.string().nullish(),
  status: z.enum(["draft", "approved"]).default("draft"),
});

type RecipeInput = z.infer<typeof recipeInputSchema>;

function inputToInsert(userId: number, input: RecipeInput) {
  return {
    userId,
    name: input.name,
    petName: input.petName ?? null,
    petId: input.petId ?? null,
    species: input.species,
    lifeStage: input.lifeStage,
    bodyWeightKg: input.bodyWeightKg.toString(),
    lifeStageFactor: input.lifeStageFactor.toString(),
    feedingMode: input.feedingMode,
    workflow: input.workflow,
    startingVolumeG: input.startingVolumeG,
    targetProteinPct: input.targetProteinPct?.toString() ?? null,
    targetCarbPct: input.targetCarbPct?.toString() ?? null,
    items: input.items,
    notes: input.notes ?? null,
    status: input.status,
    updatedByUserId: userId,
  };
}

function partialInputToPatch(d: Partial<RecipeInput>, actorUserId: number) {
  return {
    ...(d.name !== undefined && { name: d.name }),
    ...(d.petName !== undefined && { petName: d.petName ?? null }),
    ...(d.petId !== undefined && { petId: d.petId ?? null }),
    ...(d.species !== undefined && { species: d.species }),
    ...(d.lifeStage !== undefined && { lifeStage: d.lifeStage }),
    ...(d.bodyWeightKg !== undefined && { bodyWeightKg: d.bodyWeightKg.toString() }),
    ...(d.lifeStageFactor !== undefined && { lifeStageFactor: d.lifeStageFactor.toString() }),
    ...(d.feedingMode !== undefined && { feedingMode: d.feedingMode }),
    ...(d.workflow !== undefined && { workflow: d.workflow }),
    ...(d.startingVolumeG !== undefined && { startingVolumeG: d.startingVolumeG }),
    ...(d.targetProteinPct !== undefined && {
      targetProteinPct: d.targetProteinPct?.toString() ?? null,
    }),
    ...(d.targetCarbPct !== undefined && {
      targetCarbPct: d.targetCarbPct?.toString() ?? null,
    }),
    ...(d.items !== undefined && { items: d.items }),
    ...(d.notes !== undefined && { notes: d.notes ?? null }),
    ...(d.status !== undefined && { status: d.status }),
    updatedByUserId: actorUserId,
    updatedAt: new Date(),
  };
}

async function readRecipeWithRole(recipeId: number, userId: number) {
  const access = await getRecipeAccess(recipeId, userId);
  if (!access.recipe || !access.role) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
  }
  return access;
}

async function newShareToken(): Promise<string> {
  // 32 random bytes -> 43-char base64url. Tokens are unguessable but compact.
  return crypto.randomBytes(32).toString("base64url");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  recipes: router({
    list: protectedProcedure.query(({ ctx }) => listRecipesByUser(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { recipe, role } = await readRecipeWithRole(input.id, ctx.user.id);
        return { ...recipe!, role };
      }),

    create: protectedProcedure
      .input(recipeInputSchema)
      .mutation(async ({ ctx, input }) => {
        // Tx: insert + activity must be atomic so the audit log can never
        // diverge from the row state under partial failure.
        const r = await withTransaction(async (tx) => {
          const created = await createRecipe(inputToInsert(ctx.user.id, input), tx);
          await appendActivity(
            {
              recipeId: created.id,
              actorUserId: ctx.user.id,
              action: "created",
              payload: { name: created.name },
            },
            tx,
          );
          return created;
        });
        return { id: r.id };
      }),

    /**
     * Last-write-wins update with optional optimistic concurrency.
     *
     * If `expectedUpdatedAt` is supplied and the row has moved on since the
     * client loaded it, we throw `CONFLICT` with structured cause data so
     * the client can show a "someone else edited this" dialog and offer
     * Overwrite / Save as duplicate / Cancel.
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: recipeInputSchema.partial(),
          expectedUpdatedAt: z.date().nullish(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { recipe, role } = await readRecipeWithRole(input.id, ctx.user.id);
        if (!canWrite(role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Read-only access" });
        }
        const patch = partialInputToPatch(input.data, ctx.user.id);
        // Use SQL compare-and-set when the client supplied a baseline so the
        // staleness check and the write are one atomic operation. Without
        // CAS, two concurrent writers can both pass a pre-read precheck and
        // silently clobber each other.
        const throwConflict = async () => {
          const fresh = await getRecipeRowById(input.id);
          const writer = fresh?.updatedByUserId
            ? await getUserById(fresh.updatedByUserId)
            : undefined;
          throw new TRPCError({
            code: "CONFLICT",
            message: "Recipe was modified by someone else",
            cause: {
              kind: "stale-update",
              lastUpdatedAt: fresh?.updatedAt?.toISOString() ?? null,
              lastUpdatedByName: writer?.name ?? writer?.email ?? null,
            },
          });
        };
        const updated = await withTransaction(async (tx) => {
          let u: Awaited<ReturnType<typeof updateRecipeById>>;
          if (input.expectedUpdatedAt && recipe!.updatedAt) {
            // CAS against the client's baseline, not the pre-read row —
            // otherwise a writer that races between the pre-read and the
            // CAS would still clobber. Postgres timestamp resolution is
            // microsecond, so we don't need an epsilon here.
            u = await updateRecipeIfUnchanged(
              input.id,
              input.expectedUpdatedAt,
              patch,
              tx,
            );
            if (!u) await throwConflict();
          } else {
            u = await updateRecipeById(input.id, patch, tx);
            if (!u) throw new TRPCError({ code: "NOT_FOUND" });
          }
          const diff = diffRecipes(recipe!, u!);
          if (!isEmptyDiff(diff)) {
            await appendActivity(
              {
                recipeId: input.id,
                actorUserId: ctx.user.id,
                action:
                  diff.fields.length === 1 && diff.fields[0]?.field === "status"
                    ? "status_changed"
                    : "edited",
                payload: { diff },
              },
              tx,
            );
          }
          return u!;
        });
        return { success: true, updatedAt: updated.updatedAt } as const;
      }),

    /**
     * Save a copy of the recipe under the current user's account. Used by
     * the conflict dialog ("Save as duplicate") and by collaborators who
     * want their own forkable copy.
     */
    duplicate: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          nameSuffix: z.string().optional(),
          /**
           * Optional in-flight edit payload. The conflict dialog passes
           * this so "Save as duplicate" preserves the user's *unsaved*
           * edits instead of cloning whatever the other editor just
           * committed. When omitted (e.g. plain "fork this recipe"
           * intent), we fall back to the current server row.
           */
          payload: recipeInputSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { recipe } = await readRecipeWithRole(input.id, ctx.user.id);
        const serverRow = recipe!;
        // Source the duplicate from the in-flight payload when present;
        // otherwise fall back to the server row for a plain clone.
        const src = input.payload
          ? inputToInsert(ctx.user.id, input.payload)
          : {
              userId: ctx.user.id,
              name: serverRow.name,
              petName: serverRow.petName,
              petId: serverRow.petId,
              species: serverRow.species,
              lifeStage: serverRow.lifeStage,
              bodyWeightKg: serverRow.bodyWeightKg,
              lifeStageFactor: serverRow.lifeStageFactor,
              feedingMode: serverRow.feedingMode,
              workflow: serverRow.workflow,
              startingVolumeG: serverRow.startingVolumeG,
              targetProteinPct: serverRow.targetProteinPct,
              targetCarbPct: serverRow.targetCarbPct,
              items: serverRow.items,
              notes: serverRow.notes,
              status: "draft" as const,
              updatedByUserId: ctx.user.id,
            };
        const created = await withTransaction(async (tx) => {
          const c = await createRecipe(
            {
              ...src,
              userId: ctx.user.id,
              // The duplicate is always a draft owned by the caller and
              // takes a "(copy)" suffix unless overridden.
              name: `${src.name}${input.nameSuffix ?? " (copy)"}`.slice(0, 200),
              status: "draft",
              updatedByUserId: ctx.user.id,
            },
            tx,
          );
          await appendActivity(
            {
              recipeId: c.id,
              actorUserId: ctx.user.id,
              action: "duplicated",
              payload: {
                sourceRecipeId: serverRow.id,
                sourceName: serverRow.name,
                fromUnsavedEdits: !!input.payload,
              },
            },
            tx,
          );
          return c;
        });
        return { id: created.id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { role } = await readRecipeWithRole(input.id, ctx.user.id);
        if (role !== "owner") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can delete" });
        }
        await deleteRecipeById(input.id);
        return { success: true } as const;
      }),

    /**
     * Append-only activity log for a recipe. Owners and collaborators can read.
     */
    history: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await readRecipeWithRole(input.id, ctx.user.id);
        const entries = await listActivityForRecipe(input.id);
        // Opening the History panel counts as "seen" — any unseen badge
        // for this recipe should disappear immediately on the next list
        // refresh. Done after the read so we don't race the query result.
        await markRecipeActivitySeen(ctx.user.id, input.id);
        return entries;
      }),

    /**
     * Update the user's "last seen" pointer for a recipe so the unread
     * badge on /home clears. Called when the recipe builder opens.
     */
    markSeen: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        // readRecipeWithRole enforces that the caller actually has access
        // to the recipe; otherwise anyone could seed pointer rows.
        await readRecipeWithRole(input.id, ctx.user.id);
        await markRecipeActivitySeen(ctx.user.id, input.id);
        return { success: true } as const;
      }),

    /**
     * Import a recipe from either a `.guga.json` file or a previously
     * exported PDF (which carries the same JSON after %%EOF). Always creates
     * a draft owned by the current user.
     */
    import: protectedProcedure
      .input(
        z.object({
          base64: z.string().min(1),
          contentType: z.string().nullish(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const buf = Buffer.from(input.base64, "base64");
        let parsed;
        try {
          parsed = parseRecipeImport(buf, input.contentType ?? null);
        } catch (e) {
          if (e instanceof ImportError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          }
          throw e;
        }
        const r = parsed.recipe;
        const created = await withTransaction(async (tx) => {
          const c = await createRecipe(
            {
              userId: ctx.user.id,
              name: `${r.name} (imported)`.slice(0, 200),
              petName: r.petName ?? null,
              petId: r.petId ?? null,
              species: r.species,
              lifeStage: r.lifeStage,
              bodyWeightKg: r.bodyWeightKg.toString(),
              lifeStageFactor: r.lifeStageFactor.toString(),
              feedingMode: r.feedingMode,
              workflow: r.workflow,
              startingVolumeG: r.startingVolumeG,
              targetProteinPct: r.targetProteinPct?.toString() ?? null,
              targetCarbPct: r.targetCarbPct?.toString() ?? null,
              items: r.items,
              notes: r.notes ?? null,
              status: "draft",
              updatedByUserId: ctx.user.id,
            },
            tx,
          );
          await appendActivity(
            {
              recipeId: c.id,
              actorUserId: ctx.user.id,
              action: parsed.source === "pdf" ? "imported_from_pdf" : "imported_from_file",
              payload: {
                sourceName: r.name,
                droppedIngredientIds: parsed.unknownIngredientIds,
              },
            },
            tx,
          );
          return c;
        });
        return {
          id: created.id,
          source: parsed.source,
          unknownIngredientIds: parsed.unknownIngredientIds,
        };
      }),

    /**
     * Sharing — link + collaborator management. Owner-only.
     */
    share: router({
      /**
       * Owner-only: returns the active share token and full collaborator
       * list. Editors and viewers must not see the share controls — the UI
       * also gates on this, but enforcing it server-side closes the API.
       */
      get: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
          const { role } = await readRecipeWithRole(input.id, ctx.user.id);
          if (!canManageSharing(role)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only the owner can view sharing settings",
            });
          }
          const link = await getShareLinkByRecipe(input.id);
          const collaborators = await listCollaborators(input.id);
          // Surface the owner so the dialog can render a complete "people
          // with access" list (Owner / Editor / Viewer rows). The owner row
          // is informational only — the UI never offers role/remove
          // controls for it.
          const fresh = await getRecipeRowById(input.id);
          const owner = fresh ? await getUserById(fresh.userId) : undefined;
          return {
            role,
            link: link
              ? {
                  token: link.token,
                  isActive: link.isActive,
                  createdAt: link.createdAt,
                  revokedAt: link.revokedAt,
                }
              : null,
            owner: owner
              ? {
                  userId: owner.id,
                  name: owner.name ?? null,
                  email: owner.email ?? null,
                }
              : null,
            collaborators,
          };
        }),

      createOrRotate: protectedProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            // Optional override for the role granted to link visitors. If
            // omitted, an existing link keeps its current defaultRole and a
            // brand-new link defaults to "viewer".
            defaultRole: z.enum(["viewer", "editor"]).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const { role } = await readRecipeWithRole(input.id, ctx.user.id);
          if (!canManageSharing(role)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can share" });
          }
          const token = await newShareToken();
          await withTransaction(async (tx) => {
            const { created } = await upsertShareLink(
              {
                recipeId: input.id,
                token,
                createdByUserId: ctx.user.id,
                defaultRole: input.defaultRole,
              },
              tx,
            );
            // Differentiate the activity entry: initial creation logs
            // `shared` (matching the enum's intent), rotations log
            // `link_rotated`. This keeps the timeline readable and the
            // enum free of dead values.
            await appendActivity(
              {
                recipeId: input.id,
                actorUserId: ctx.user.id,
                action: created ? "shared" : "link_rotated",
              },
              tx,
            );
          });
          return { token };
        }),

      disable: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const { role } = await readRecipeWithRole(input.id, ctx.user.id);
          if (!canManageSharing(role)) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
          await withTransaction(async (tx) => {
            await disableShareLink(input.id, tx);
            await appendActivity(
              { recipeId: input.id, actorUserId: ctx.user.id, action: "link_disabled" },
              tx,
            );
          });
          return { success: true } as const;
        }),

      setRole: protectedProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            userId: z.number().int().positive(),
            role: z.enum(["viewer", "editor"]),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const { role } = await readRecipeWithRole(input.id, ctx.user.id);
          if (!canManageSharing(role)) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
          const targetUser = await getUserById(input.userId);
          if (!targetUser) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
          }
          await withTransaction(async (tx) => {
            const result = await addOrUpdateCollaborator(
              {
                recipeId: input.id,
                userId: input.userId,
                role: input.role,
                addedByUserId: ctx.user.id,
              },
              tx,
            );
            await appendActivity(
              {
                recipeId: input.id,
                actorUserId: ctx.user.id,
                action: result.created ? "collaborator_added" : "collaborator_role_changed",
                payload: {
                  targetUserId: input.userId,
                  targetUserName: targetUser.name ?? targetUser.email ?? null,
                  role: input.role,
                },
              },
              tx,
            );
          });
          return { success: true } as const;
        }),

      removeCollaborator: protectedProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            userId: z.number().int().positive(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const { role } = await readRecipeWithRole(input.id, ctx.user.id);
          if (!canManageSharing(role)) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
          const targetUser = await getUserById(input.userId);
          await withTransaction(async (tx) => {
            await removeCollaborator(input.id, input.userId, tx);
            await appendActivity(
              {
                recipeId: input.id,
                actorUserId: ctx.user.id,
                action: "collaborator_removed",
                payload: {
                  targetUserId: input.userId,
                  targetUserName: targetUser?.name ?? targetUser?.email ?? null,
                },
              },
              tx,
            );
          });
          return { success: true } as const;
        }),

      /**
       * Visit a share link. If the visitor is signed in and isn't already
       * the owner or a collaborator, they're added as a viewer. The owner
       * can later promote them to editor via `setRole`.
       *
       * Token-only metadata (no user) returns just `{ recipeId, name }` so
       * the public landing page can show what's behind the link.
       */
      lookupByToken: publicProcedure
        .input(z.object({ token: z.string().min(8).max(128) }))
        .query(async ({ input }) => {
          const link = await getShareLinkByToken(input.token);
          if (!link || !link.isActive) return null;
          const recipe = await getRecipeRowById(link.recipeId);
          if (!recipe) return null;
          return {
            recipeId: recipe.id,
            recipeName: recipe.name,
            species: recipe.species,
          };
        }),

      join: protectedProcedure
        .input(z.object({ token: z.string().min(8).max(128) }))
        .mutation(async ({ ctx, input }) => {
          const link = await getShareLinkByToken(input.token);
          if (!link || !link.isActive) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Share link inactive" });
          }
          const access = await getRecipeAccess(link.recipeId, ctx.user.id);
          if (access.role) {
            return { recipeId: link.recipeId, role: access.role };
          }
          // Honor the link's defaultRole (typically "viewer", but the
          // owner can configure it via createOrRotate).
          const grantRole = link.defaultRole ?? "viewer";
          await withTransaction(async (tx) => {
            await addOrUpdateCollaborator(
              {
                recipeId: link.recipeId,
                userId: ctx.user.id,
                role: grantRole,
                addedByUserId: link.createdByUserId,
              },
              tx,
            );
            await appendActivity(
              {
                recipeId: link.recipeId,
                actorUserId: ctx.user.id,
                action: "collaborator_added",
                payload: {
                  targetUserId: ctx.user.id,
                  targetUserName: ctx.user.name ?? ctx.user.email ?? null,
                  role: grantRole,
                  via: "share-link",
                },
              },
              tx,
            );
          });
          return { recipeId: link.recipeId, role: grantRole };
        }),
    }),

    /**
     * Download the recipe as a portable `.guga.json` file. Embedded
     * verbatim inside the exported PDF as well.
     */
    exportRecipeFile: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { recipe } = await readRecipeWithRole(input.id, ctx.user.id);
        const r = recipe!;
        const portable = portableRecipeSchema.parse({
          name: r.name,
          petName: r.petName ?? null,
          petId: r.petId ?? null,
          species: r.species,
          lifeStage: r.lifeStage,
          bodyWeightKg: Number(r.bodyWeightKg),
          lifeStageFactor: Number(r.lifeStageFactor),
          feedingMode: r.feedingMode,
          workflow: r.workflow,
          startingVolumeG: r.startingVolumeG,
          targetProteinPct: r.targetProteinPct ? Number(r.targetProteinPct) : null,
          targetCarbPct: r.targetCarbPct ? Number(r.targetCarbPct) : null,
          items: (r.items as { ingredientId: number; grams: number }[]) ?? [],
          notes: r.notes ?? null,
        });
        const file = {
          guga: 1 as const,
          exportedAt: new Date().toISOString(),
          recipe: portable,
        };
        const json = JSON.stringify(file, null, 2);
        return {
          base64: Buffer.from(json, "utf8").toString("base64"),
          filename: `GUGA_${slugify(r.name)}.guga.json`,
        };
      }),

    exportPdf: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          lang: z.enum(["en", "zh", "th"]).default("en"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { recipe } = await readRecipeWithRole(input.id, ctx.user.id);
        const r = recipe!;
        const pdf = await generateRecipePdf({
          lang: input.lang,
          recipe: {
            name: r.name,
            petName: r.petName ?? null,
            petId: r.petId ?? null,
            species: r.species as "dog" | "cat",
            lifeStageKey: r.lifeStage,
            bodyWeightKg: Number(r.bodyWeightKg),
            lifeStageFactor: Number(r.lifeStageFactor),
            items: (r.items as { ingredientId: number; grams: number }[]) ?? [],
            notes: r.notes ?? null,
            status: (r.status as "draft" | "approved") ?? "draft",
            updatedAt: r.updatedAt ?? null,
            ownerName: ctx.user.name ?? null,
            ownerEmail: ctx.user.email ?? null,
            // Pass through everything needed for a faithful import round-trip.
            feedingMode: r.feedingMode as "normal" | "weight_loss",
            workflow: r.workflow as "wizard" | "simple" | "premix",
            startingVolumeG: r.startingVolumeG,
            targetProteinPct: r.targetProteinPct ? Number(r.targetProteinPct) : null,
            targetCarbPct: r.targetCarbPct ? Number(r.targetCarbPct) : null,
          },
        });
        return {
          base64: pdf.toString("base64"),
          filename: `GUGA_${slugify(r.name)}_${input.lang}.pdf`,
        };
      }),
  }),
});

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "recipe"
  );
}

export type AppRouter = typeof appRouter;
