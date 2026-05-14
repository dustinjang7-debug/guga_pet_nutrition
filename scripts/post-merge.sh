#!/bin/bash
set -e

# Install any new deps from the merged task. --frozen-lockfile is implied by
# pnpm install in CI mode; we avoid --frozen-lockfile so a regenerated
# lockfile from the task agent doesn't block setup.
pnpm install

# Apply any new Drizzle migrations to the Replit-managed Postgres.
# `db:push` is a no-op when the DB schema already matches.
if [ -n "${DATABASE_URL:-}" ]; then
  pnpm run db:push --force || true
fi
