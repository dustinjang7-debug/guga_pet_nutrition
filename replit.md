# GUGA Pet Nutrition

Web app for composing AAFCO-aligned fresh-food pet recipes from a 238-ingredient database.

## Run & Operate
- Dev: `pnpm run dev` (PORT=5000) — Express + Vite middleware on a single port
- Build: `pnpm run build`
- Start (prod): `pnpm run start`
- Typecheck: `pnpm run check`
- Tests: `pnpm run test`
- DB migrate: `pnpm run db:push` (requires MySQL `DATABASE_URL`)

Env vars (all optional for local boot — DB and auth are lazy):
`DATABASE_URL` (mysql), `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`.

## Stack
- Node 20, pnpm, TypeScript 5.9
- React 19 + Vite 7 + TailwindCSS 4 + wouter
- Express 4 + tRPC 11
- Drizzle ORM (MySQL via mysql2)

## Where things live
- `client/` — React app (Vite root)
- `server/_core/` — Express bootstrap, tRPC context, Vite middleware, OAuth, env
- `server/routers.ts` — tRPC routers
- `shared/` — Calc/nutrition logic shared with client
- `drizzle/schema.ts` — DB schema (source of truth)
- `vite.config.ts` — Vite config (allows all hosts for Replit proxy)

## Architecture decisions
- Single-port dev: Express mounts Vite as middleware on port 5000
- DB is lazily connected; app boots without `DATABASE_URL`
- `getLoginUrl()` returns `#` when `VITE_OAUTH_PORTAL_URL` is unset to avoid runtime crash

## Replit setup
- Workflow `Start application`: `PORT=5000 pnpm run dev`, port 5000, webview
- Deployment: autoscale, build `pnpm run build`, run `pnpm run start`
