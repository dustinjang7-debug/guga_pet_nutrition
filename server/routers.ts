import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipesByUser,
  updateRecipe,
} from "./db";

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
  workflow: z.enum(["wizard", "simple"]).default("simple"),
  startingVolumeG: z.number().int().positive().max(100000).default(1000),
  targetProteinPct: z.number().min(0).max(100).nullish(),
  targetCarbPct: z.number().min(0).max(100).nullish(),
  items: z.array(recipeItemSchema),
  notes: z.string().nullish(),
  status: z.enum(["draft", "approved"]).default("draft"),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        const r = await getRecipeById(ctx.user.id, input.id);
        if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
        return r;
      }),

    create: protectedProcedure
      .input(recipeInputSchema)
      .mutation(async ({ ctx, input }) => {
        const id = await createRecipe({
          userId: ctx.user.id,
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
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), data: recipeInputSchema.partial() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getRecipeById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const d = input.data;
        await updateRecipe(ctx.user.id, input.id, {
          ...(d.name !== undefined && { name: d.name }),
          ...(d.petName !== undefined && { petName: d.petName }),
          ...(d.petId !== undefined && { petId: d.petId }),
          ...(d.species !== undefined && { species: d.species }),
          ...(d.lifeStage !== undefined && { lifeStage: d.lifeStage }),
          ...(d.bodyWeightKg !== undefined && { bodyWeightKg: d.bodyWeightKg.toString() }),
          ...(d.lifeStageFactor !== undefined && { lifeStageFactor: d.lifeStageFactor.toString() }),
          ...(d.feedingMode !== undefined && { feedingMode: d.feedingMode }),
          ...(d.workflow !== undefined && { workflow: d.workflow }),
          ...(d.startingVolumeG !== undefined && { startingVolumeG: d.startingVolumeG }),
          ...(d.targetProteinPct !== undefined && { targetProteinPct: d.targetProteinPct?.toString() ?? null }),
          ...(d.targetCarbPct !== undefined && { targetCarbPct: d.targetCarbPct?.toString() ?? null }),
          ...(d.items !== undefined && { items: d.items }),
          ...(d.notes !== undefined && { notes: d.notes }),
          ...(d.status !== undefined && { status: d.status }),
        });
        return { success: true } as const;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteRecipe(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
