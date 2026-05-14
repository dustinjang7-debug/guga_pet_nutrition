/**
 * Integration-style tests for the sharing pipeline + concurrency conflict
 * path. Uses an in-memory mock of the few `db.ts` functions the sharing
 * routers touch — we don't spin up Postgres, but we still exercise the
 * full tRPC procedure (auth, role checks, transactions, activity log).
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- In-memory state -------------------------------------------------------

interface RecipeRow {
  id: number;
  userId: number;
  updatedByUserId: number | null;
  name: string;
  petName: string | null;
  petId: string | null;
  species: "dog" | "cat";
  lifeStage: string;
  bodyWeightKg: string;
  lifeStageFactor: string;
  feedingMode: "normal" | "weight_loss";
  workflow: "wizard" | "simple" | "premix";
  startingVolumeG: number;
  targetProteinPct: string | null;
  targetCarbPct: string | null;
  items: { ingredientId: number; grams: number }[];
  notes: string | null;
  status: "draft" | "approved";
  createdAt: Date;
  updatedAt: Date;
}

interface CollabRow {
  id: number;
  recipeId: number;
  userId: number;
  role: "viewer" | "editor";
  addedByUserId: number;
  addedAt: Date;
}

interface ShareLinkRow {
  recipeId: number;
  token: string;
  createdByUserId: number;
  isActive: boolean;
  defaultRole: "viewer" | "editor";
  createdAt: Date;
  revokedAt: Date | null;
}

interface ActivityRow {
  id: number;
  recipeId: number;
  actorUserId: number;
  action: string;
  payload: unknown;
  createdAt: Date;
}

interface UserRow {
  id: number;
  openId: string;
  email: string | null;
  name: string | null;
}

const state = {
  recipes: [] as RecipeRow[],
  collabs: [] as CollabRow[],
  shareLinks: [] as ShareLinkRow[],
  activity: [] as ActivityRow[],
  users: [] as UserRow[],
  nextRecipeId: 1,
  nextCollabId: 1,
  nextActivityId: 1,
};

function reset() {
  state.recipes = [];
  state.collabs = [];
  state.shareLinks = [];
  state.activity = [];
  state.users = [
    { id: 1, openId: "owner", email: "owner@x", name: "Owner" },
    { id: 2, openId: "guest", email: "guest@x", name: "Guest" },
    { id: 3, openId: "third", email: "third@x", name: "Third" },
  ];
  state.nextRecipeId = 1;
  state.nextCollabId = 1;
  state.nextActivityId = 1;
}

// ---- Mock the db module ----------------------------------------------------

vi.mock("./recipeAccess", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./recipeAccess")>();
  return {
    ...actual,
    getRecipeAccess: async (recipeId: number, userId: number) => {
      const found = state.recipes.find((r) => r.id === recipeId);
      const recipe = found ? { ...found } : null;
      if (!recipe) return { role: null, recipe: null };
      if (recipe.userId === userId) return { role: "owner", recipe };
      const c = state.collabs.find((x) => x.recipeId === recipeId && x.userId === userId);
      if (c) return { role: c.role, recipe };
      return { role: null, recipe };
    },
  };
});

vi.mock("./db", () => ({
  getDb: async () => null,
  withTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
  listRecipesByUser: async (uid: number) => {
    const owned = state.recipes
      .filter((r) => r.userId === uid)
      .map((r) => ({ ...r, role: "owner" as const }));
    const shared = state.collabs
      .filter((c) => c.userId === uid)
      .map((c) => {
        const r = state.recipes.find((rr) => rr.id === c.recipeId)!;
        return { ...r, role: c.role };
      });
    return [...owned, ...shared];
  },
  getRecipeRowById: async (id: number) => {
    const r = state.recipes.find((rr) => rr.id === id);
    return r ? { ...r } : undefined;
  },
  createRecipe: async (input: Partial<RecipeRow>) => {
    const r: RecipeRow = {
      id: state.nextRecipeId++,
      userId: input.userId!,
      updatedByUserId: input.updatedByUserId ?? input.userId!,
      name: input.name!,
      petName: input.petName ?? null,
      petId: input.petId ?? null,
      species: (input.species as "dog" | "cat") ?? "dog",
      lifeStage: input.lifeStage ?? "adult",
      bodyWeightKg: String(input.bodyWeightKg ?? "10"),
      lifeStageFactor: String(input.lifeStageFactor ?? "1.6"),
      feedingMode: (input.feedingMode as "normal" | "weight_loss") ?? "normal",
      workflow: (input.workflow as "wizard" | "simple" | "premix") ?? "simple",
      startingVolumeG: input.startingVolumeG ?? 1000,
      targetProteinPct: input.targetProteinPct ?? null,
      targetCarbPct: input.targetCarbPct ?? null,
      items: (input.items as RecipeRow["items"]) ?? [],
      notes: input.notes ?? null,
      status: (input.status as "draft" | "approved") ?? "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.recipes.push(r);
    return r;
  },
  updateRecipeById: async (id: number, patch: Partial<RecipeRow>) => {
    const idx = state.recipes.findIndex((rr) => rr.id === id);
    if (idx < 0) return undefined;
    const next = { ...state.recipes[idx], ...patch, updatedAt: new Date(Date.now() + 1000) };
    state.recipes[idx] = next;
    return { ...next };
  },
  updateRecipeIfUnchanged: async (
    id: number,
    expectedUpdatedAt: Date,
    patch: Partial<RecipeRow>,
  ) => {
    const idx = state.recipes.findIndex((rr) => rr.id === id);
    if (idx < 0) return undefined;
    const cur = state.recipes[idx];
    if (cur.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return undefined;
    const next = { ...cur, ...patch, updatedAt: new Date(Date.now() + 1000) };
    state.recipes[idx] = next;
    return { ...next };
  },
  deleteRecipeById: async (id: number) => {
    state.recipes = state.recipes.filter((r) => r.id !== id);
    state.collabs = state.collabs.filter((c) => c.recipeId !== id);
    state.shareLinks = state.shareLinks.filter((s) => s.recipeId !== id);
    state.activity = state.activity.filter((a) => a.recipeId !== id);
  },
  appendActivity: async (entry: Omit<ActivityRow, "id" | "createdAt">) => {
    state.activity.push({ ...entry, id: state.nextActivityId++, createdAt: new Date() });
  },
  listActivityForRecipe: async (rid: number) =>
    state.activity
      .filter((a) => a.recipeId === rid)
      .map((a) => ({ ...a, actorName: null, actorEmail: null }))
      .reverse(),
  getShareLinkByRecipe: async (rid: number) =>
    state.shareLinks.find((s) => s.recipeId === rid),
  getShareLinkByToken: async (token: string) =>
    state.shareLinks.find((s) => s.token === token),
  upsertShareLink: async (input: {
    recipeId: number;
    token: string;
    createdByUserId: number;
    defaultRole?: "viewer" | "editor";
  }) => {
    const existing = state.shareLinks.find((s) => s.recipeId === input.recipeId);
    if (existing) {
      existing.token = input.token;
      existing.isActive = true;
      existing.revokedAt = null;
      if (input.defaultRole) existing.defaultRole = input.defaultRole;
      return { row: existing, created: false };
    }
    const row: ShareLinkRow = {
      recipeId: input.recipeId,
      token: input.token,
      createdByUserId: input.createdByUserId,
      defaultRole: input.defaultRole ?? "viewer",
      isActive: true,
      createdAt: new Date(),
      revokedAt: null,
    };
    state.shareLinks.push(row);
    return { row, created: true };
  },
  disableShareLink: async (rid: number) => {
    const s = state.shareLinks.find((x) => x.recipeId === rid);
    if (s) {
      s.isActive = false;
      s.revokedAt = new Date();
    }
  },
  listCollaborators: async (rid: number) =>
    state.collabs
      .filter((c) => c.recipeId === rid)
      .map((c) => ({ ...c, name: null, email: null })),
  addOrUpdateCollaborator: async (input: {
    recipeId: number;
    userId: number;
    role: "viewer" | "editor";
    addedByUserId: number;
  }) => {
    const existing = state.collabs.find(
      (c) => c.recipeId === input.recipeId && c.userId === input.userId,
    );
    if (existing) {
      existing.role = input.role;
      return { created: false };
    }
    state.collabs.push({
      id: state.nextCollabId++,
      recipeId: input.recipeId,
      userId: input.userId,
      role: input.role,
      addedByUserId: input.addedByUserId,
      addedAt: new Date(),
    });
    return { created: true };
  },
  removeCollaborator: async (rid: number, uid: number) => {
    state.collabs = state.collabs.filter((c) => !(c.recipeId === rid && c.userId === uid));
  },
  getUserById: async (id: number) => state.users.find((u) => u.id === id),
}));

// Import after vi.mock
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(userId: number): TrpcContext {
  const u = state.users.find((x) => x.id === userId)!;
  return {
    user: {
      id: u.id,
      openId: u.openId,
      email: u.email,
      name: u.name,
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

async function makeRecipe(ownerId: number) {
  const caller = appRouter.createCaller(ctxFor(ownerId));
  const created = await caller.recipes.create({
    name: "R",
    species: "dog",
    lifeStage: "adult",
    bodyWeightKg: 10,
    lifeStageFactor: 1.6,
    feedingMode: "normal",
    workflow: "simple",
    startingVolumeG: 1000,
    items: [{ ingredientId: 1, grams: 100 }],
    status: "draft",
  });
  return created.id;
}

beforeEach(() => reset());

describe("recipes.share.* — link join + role enforcement", () => {
  it("owner creates a link, guest joins as viewer, viewer write is denied", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const guest = appRouter.createCaller(ctxFor(2));
    const id = await makeRecipe(1);

    const { token } = await owner.recipes.share.createOrRotate({ id });
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,}$/);

    // Guest can look up link (public) and join (auth'd).
    const meta = await guest.recipes.share.lookupByToken({ token });
    expect(meta?.recipeName).toBe("R");

    const join = await guest.recipes.share.join({ token });
    expect(join.role).toBe("viewer");

    // Viewer cannot update the recipe.
    await expect(
      guest.recipes.update({ id, data: { name: "tampered" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Owner promotes to editor; now update succeeds.
    await owner.recipes.share.setRole({ id, userId: 2, role: "editor" });
    await guest.recipes.update({ id, data: { name: "edited by editor" } });
    expect(state.recipes[0].name).toBe("edited by editor");

    // Activity log captures every step.
    const actions = state.activity.filter((a) => a.recipeId === id).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "created",
        "shared",
        "collaborator_added",
        "collaborator_role_changed",
        "edited",
      ]),
    );
  });

  it("rotating an existing link logs `link_rotated`, not `shared`", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const id = await makeRecipe(1);
    await owner.recipes.share.createOrRotate({ id }); // initial → "shared"
    await owner.recipes.share.createOrRotate({ id }); // rotation → "link_rotated"
    const actions = state.activity.filter((a) => a.recipeId === id).map((a) => a.action);
    expect(actions).toContain("shared");
    expect(actions).toContain("link_rotated");
  });

  it("share.join honors the link's defaultRole when the owner sets editor", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const guest = appRouter.createCaller(ctxFor(2));
    const id = await makeRecipe(1);
    const { token } = await owner.recipes.share.createOrRotate({ id, defaultRole: "editor" });
    const join = await guest.recipes.share.join({ token });
    expect(join.role).toBe("editor");
    // Editor really can write.
    await guest.recipes.update({ id, data: { name: "edited via editor link" } });
    expect(state.recipes[0].name).toBe("edited via editor link");
  });

  it("non-owner cannot read share settings, but can read the recipe", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const guest = appRouter.createCaller(ctxFor(2));
    const id = await makeRecipe(1);
    const { token } = await owner.recipes.share.createOrRotate({ id });
    await guest.recipes.share.join({ token });

    // Viewer can see the recipe itself…
    const r = await guest.recipes.get({ id });
    expect(r.role).toBe("viewer");

    // …but cannot list share controls (token, collaborators).
    await expect(guest.recipes.share.get({ id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("disabled link rejects further joins", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const guest = appRouter.createCaller(ctxFor(2));
    const id = await makeRecipe(1);
    const { token } = await owner.recipes.share.createOrRotate({ id });
    await owner.recipes.share.disable({ id });

    expect(await guest.recipes.share.lookupByToken({ token })).toBeNull();
    await expect(guest.recipes.share.join({ token })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("recipes.update — concurrency CONFLICT", () => {
  it("returns CONFLICT with structured cause when expectedUpdatedAt is stale", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const id = await makeRecipe(1);

    // First save bumps updatedAt.
    await owner.recipes.update({ id, data: { name: "v2" } });
    const stale = new Date(state.recipes[0].updatedAt.getTime() - 60_000);

    let caught: TRPCError | null = null;
    try {
      await owner.recipes.update({
        id,
        data: { name: "v3" },
        expectedUpdatedAt: stale,
      });
    } catch (e) {
      caught = e as TRPCError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe("CONFLICT");
    const cause = caught!.cause as Record<string, unknown> | undefined;
    expect(cause?.kind).toBe("stale-update");
    expect(typeof cause?.lastUpdatedAt).toBe("string");
  });

  it("`Save as duplicate` after a conflict preserves the caller's unsaved edits", async () => {
    // Reproduces the conflict-flow expectation: when two editors race,
    // the loser's "Save as duplicate" must clone the *local* in-flight
    // payload, not whatever the winning editor just wrote to the server.
    const owner = appRouter.createCaller(ctxFor(1));
    const id = await makeRecipe(1);

    // Other editor commits first → server row is now "winner-version".
    await owner.recipes.update({ id, data: { name: "winner-version" } });

    // Loser's local form had different unsaved edits and a different
    // ingredient list; this is what the conflict dialog should preserve.
    const localPayload = {
      name: "my-unsaved-version",
      species: "dog" as const,
      lifeStage: "adult",
      bodyWeightKg: 12,
      lifeStageFactor: 1.6,
      feedingMode: "normal" as const,
      workflow: "simple" as const,
      startingVolumeG: 1500,
      items: [{ ingredientId: 7, grams: 250 }],
      status: "draft" as const,
      notes: "loser's notes",
    };
    const dup = await owner.recipes.duplicate({ id, payload: localPayload });

    const newRow = state.recipes.find((r) => r.id === dup.id)!;
    expect(newRow.name).toBe("my-unsaved-version (copy)");
    expect(newRow.notes).toBe("loser's notes");
    expect(newRow.startingVolumeG).toBe(1500);
    expect(newRow.items).toEqual([{ ingredientId: 7, grams: 250 }]);
    // The original row keeps the winner's content.
    expect(state.recipes.find((r) => r.id === id)!.name).toBe("winner-version");
  });

  it("succeeds when expectedUpdatedAt matches the current row", async () => {
    const owner = appRouter.createCaller(ctxFor(1));
    const id = await makeRecipe(1);
    const current = await owner.recipes.get({ id });
    const out = await owner.recipes.update({
      id,
      data: { name: "v2" },
      expectedUpdatedAt: current.updatedAt,
    });
    expect(out.success).toBe(true);
    expect(state.recipes[0].name).toBe("v2");
  });
});
