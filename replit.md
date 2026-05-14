# GUGA Pet Nutrition

Web app for composing AAFCO-aligned fresh-food pet recipes from a 238-ingredient database.

## Run & Operate
- Dev: `pnpm run dev` (PORT=5000) — Express + Vite middleware on a single port
- Build: `pnpm run build`
- Start (prod): `pnpm run start`
- Typecheck: `pnpm run check`
- Tests: `pnpm run test`
- DB migrate: `pnpm run db:push` (uses Postgres `DATABASE_URL`)

Env vars (all optional for local boot — DB and auth are lazy):
`DATABASE_URL` (Postgres — provided automatically by Replit), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`.

## Auth (Google OAuth)
- Sign-in: `GET /api/auth/google/login` → Google consent → `GET /api/auth/google/callback` → sets HS256 JWT session cookie (signed with `JWT_SECRET`) and redirects home.
- The user's Google `sub` is stored in `users.openId` (varchar 64). `loginMethod` is set to `"google"`.
- Google Cloud Console setup:
  1. Create an OAuth 2.0 Client ID of type "Web application".
  2. Add Authorized redirect URIs for both environments:
     - Dev:  `https://<your-replit-dev-domain>/api/auth/google/callback`
     - Prod: `https://<your-replit-app-domain>/api/auth/google/callback`
  3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Replit Secrets.

## Stack
- Node 20, pnpm, TypeScript 5.9
- React 19 + Vite 7 + TailwindCSS 4 + wouter
- Express 4 + tRPC 11
- Drizzle ORM (PostgreSQL via node-postgres)

## Where things live
- `client/` — React app (Vite root)
- `server/_core/` — Express bootstrap, tRPC context, Vite middleware, OAuth, env
- `server/routers.ts` — tRPC routers
- `shared/` — Calc/nutrition logic shared with client
- `drizzle/schema.ts` — DB schema (source of truth)
- `vite.config.ts` — Vite config (allows all hosts for Replit proxy)

## Sharing, Import, History
- **Share-by-link**: owner opens the share dialog and rotates a token; visiting `/r/<token>` while signed in calls `share.join` and adds the visitor as a `viewer`. Owner can promote viewer ⇄ editor or remove. Disabling clears `isActive`.
- **Roles**: `owner` (full), `editor` (write but no sharing/delete), `viewer` (read-only — UI disables save/picker mutations). `recipes.list` returns role-tagged owned + shared rows.
- **Concurrency**: `recipes.update` accepts `expectedUpdatedAt`; mismatch ⇒ TRPC `CONFLICT` with `cause: { kind, lastUpdatedAt, lastUpdatedByName }`. Surfaced via `errorFormatter` in `server/_core/trpc.ts`. Client conflict dialog offers Overwrite / Save as duplicate / Cancel.
- **Portable file**: `.guga.json` (`shared/recipeFile.ts`, version 1). Exported PDFs append `\n%%GUGA_RECIPE_v1:<base64>\n` after `%%EOF` so the same file is also self-importing. Import always creates a draft; unknown ingredient IDs are dropped and reported.
- **Activity log**: `recipe_activity` table; `recipes.history` returns entries with structured `diff` payloads (added/removed/changed ingredients + scalar field changes) for `edited`/`status_changed` actions.

## Architecture decisions
- Single-port dev: Express mounts Vite as middleware on port 5000
- DB is lazily connected; app boots without `DATABASE_URL`
- Sessions are HS256 JWTs in an httpOnly cookie; OAuth state is a signed/timestamped HMAC payload (no server-side state store needed)
- If a session cookie is valid but the DB row is missing, the request is treated as unauthenticated; the next sign-in recreates the row

## Replit setup
- Workflow `Start application`: `PORT=5000 pnpm run dev`, port 5000, webview
- Deployment: autoscale, build `pnpm run build`, run `pnpm run start`
