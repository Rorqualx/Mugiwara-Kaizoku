# Migration audit — fresh-install repair

Multi-session task to make `prisma migrate deploy` succeed against an
empty database. The current 66 migrations leave the schema broken: some
tables/functions are referenced but never created; one migration creates
a duplicate `Settings` table; several use enums without `CREATE TYPE`.

## Status (running)

### Known bugs (already discovered)

- [x] `20251021_add_api_webhook_settings` — duplicate `CREATE TABLE "Settings"` (fixed in commit `4f9625fb8`, needs in-image rebuild)
- [ ] `20251021_add_wanted_download_history` — missing `CREATE TYPE` for `WantedPriority` / `WantedStatus` / `DownloadHistoryStatus`
- [ ] `20251213_add_flaresolverr_autostart` — `ALTER TABLE "FlareSolverrConfig"` but no migration ever runs `CREATE TABLE "FlareSolverrConfig"`. The model IS in `schema.prisma` though — so `db push` works, `migrate deploy` doesn't
- [ ] `20260105_fix_stale_job_recovery` — functions reference `jobs_active` partition; never created in any migration; ALSO not in `schema.prisma` (only `jobs` and `jobs_volatile` are)
- [ ] `20251213_fix_job_partition_functions` — same `jobs_active` issue

### Key discovery (the architectural mess)

`schema.prisma` defines `model jobs` as a **regular table**. But migration functions in `20251213_fix_job_partition_functions` + `20260105_fix_stale_job_recovery` expect `jobs` to be **partitioned** with `jobs_active` and `jobs_archived` partitions. These are INCOMPATIBLE:

- Prisma's `db push` creates `jobs` as a regular table → functions fail at runtime ("relation jobs_active does not exist")
- The original `CREATE TABLE jobs ... PARTITION BY (status)` migration appears to have been **deleted or never committed**. There's no grep match for it anywhere in `prisma/migrations/`.

So the codebase has TWO competing sources of truth for the `jobs` table:
1. `schema.prisma` says: regular table
2. The functions in migration `20251213` say: partitioned table with `jobs_active` (active rows) / `jobs_archived` (completed/failed rows) partitions

This needs a product decision: keep partitioning (and write the missing `CREATE TABLE jobs PARTITION BY...` migration + update `schema.prisma` somehow) OR drop partitioning (and rewrite the functions to operate on the regular `jobs` table). Prisma doesn't model partitioned tables natively, so option 1 requires schema.prisma annotations to be careful.

### Counts (baseline)

- **83 models** in `schema.prisma`
- **70 enums** in `schema.prisma`
- **66 migrations** in `prisma/migrations/`
- **2 known runtime-only tables** referenced by raw SQL but not in `schema.prisma`: `jobs_active`, `jobs_archived`

## Plan

### Phase 1: Audit

1. Extract from `prisma/schema.prisma`:
   - All `model` → expected tables (with columns, types, indexes)
   - All `enum` → expected `CREATE TYPE` statements
   - `@@index` / `@@unique` → expected indexes
2. Extract from `prisma/migrations/*/migration.sql`:
   - All `CREATE TABLE` / `CREATE TYPE` / `CREATE FUNCTION` / `CREATE TRIGGER` / `CREATE INDEX` / `CREATE OR REPLACE FUNCTION`
   - All `ALTER TABLE` (to track schema evolution)
3. Grep `src/` for raw-SQL queries referencing unknown tables:
   - `prisma.$queryRaw` / `prisma.$executeRaw` invocations
   - SQL function calls in `prisma.$queryRaw(...recover_stale_jobs...)`

### Phase 2: Identify gaps

- Set difference: expected (Phase 1.1) − created (Phase 1.2) = missing objects
- Cross-check with raw-SQL references (Phase 1.3) for anything outside the Prisma model layer
- Document each gap with file:line where it's referenced

### Phase 3: Fix in code

Per-migration patches:
- Duplicate `CREATE TABLE` → convert to `ALTER TABLE ADD COLUMN IF NOT EXISTS` per column diff
- Missing `CREATE TYPE` → add at top of migration with `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL $$`
- Tables referenced but never created → add a single `2026xxxx_repair_missing_objects/migration.sql` at the end with idempotent `CREATE TABLE IF NOT EXISTS` for each

### Phase 4: Verify

- Wipe `/srv/config/postgres` on Huey
- Pull rebuilt image
- `docker compose up` — observe `migrate deploy` succeeds end-to-end
- Curl `/setup` — admin wizard renders
- Create admin, log in, add library → no DB errors

## Workarounds in flight (Huey)

- `/srv/kaizoku/entrypoint-no-migrate.sh` exists — custom entrypoint that skips `prisma migrate deploy` once migrations are bootstrapped externally
- `/srv/kaizoku/repo/` has a sparse clone for bind-mounting `packages/`
- All present `/srv/config/postgres` data is from intermediate attempts; safe to wipe at next session start

## Files touched in this work

- `prisma/migrations/20251021_add_api_webhook_settings/migration.sql` — fixed (Settings → ALTER TABLE)
- `Dockerfile` — runner stage now copies `packages/` (commit `8c7c1bfba`)
- `scripts/docker-entrypoint.sh` — bundled-postgres + P3009/P3018 auto-recovery + idempotent CREATE DATABASE

## Notes for next session

- Start with `git log --since="2026-05-20"` to recap recent infra commits
- The session's last-known-good Docker image is `ghcr.io/rorqualx/mugiwara-kaizoku@sha256:9fe610...`
- Pre-rebuilt-image users: pull again after `8c7c1bfba`'s build completes (~10-15 min from its push)
- Sample of how-bad-it-is: `jobs_active` is referenced in `recover_stale_jobs` function body. That function compiles fine via `CREATE OR REPLACE FUNCTION` (no eager validation) but blows up at first call. Means partial-broken migrations can land without revealing the problem until runtime.
