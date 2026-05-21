-- Repair-missing-objects: the consolidating migration that earlier history
-- squashes deleted. Idempotent — re-applying against a healthy DB is a no-op.
--
-- Restores:
--   1. JobType / JobPriority / JobStatus enums (referenced by `jobs` and the
--      function bodies in 20251213_fix_job_partition_functions /
--      20260105_fix_stale_job_recovery, but never CREATE TYPE'd)
--   2. The partitioned `jobs` table + `jobs_active` / `jobs_archived`
--      partitions (functions in 20251213_* reference these partitions
--      directly; `prisma db push` would create `jobs` as a plain table, which
--      breaks queue-worker SQL at runtime)
--   3. FlareSolverrConfig table (`20251213_add_flaresolverr_autostart`
--      ALTERs it but no migration CREATE TABLEs it)
--   4. FlareSolverrRequestType enum + FlareSolverrMetrics +
--      FlareSolverrMetricsHourly tables (model-only, never created)
--
-- Slotted before 20251213_* so subsequent migrations find the objects they
-- depend on. Safe to apply on a DB that already has these objects: every
-- CREATE is guarded.

-- ============================================================================
-- 1. JOB ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "JobType" AS ENUM (
        'metadata_refresh',
        'metadata_update',
        'metadata_sync',
        'chapter_check',
        'chapter_download',
        'chapter_sync',
        'backup_create',
        'backup_restore',
        'library_scan',
        'library_import',
        'notification_send',
        'notification_batch',
        'maintenance_cleanup',
        'maintenance_vacuum',
        'maintenance_reindex',
        'download_manga',
        'download_volume',
        'download_pack',
        'native_download',
        'native_sync',
        'suwayomi_sync',
        'prowlarr_search',
        'mangadex_download',
        'getcomics_download',
        'suwayomi_download'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "JobPriority" AS ENUM ('critical', 'high', 'normal', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM (
        'pending',
        'active',
        'completed',
        'failed',
        'cancelled',
        'retrying'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. PARTITIONED `jobs` TABLE
-- ============================================================================
-- Three cases at this point in the migration history:
--   a. Table doesn't exist           → create partitioned
--   b. Table exists, IS partitioned  → no-op
--   c. Table exists, is plain table  → abort with a clear error
--      (Case c is the `prisma db push` footgun; existing data must be
--      manually rescued before this migration can run.)

DO $$
DECLARE
    v_kind CHAR;
BEGIN
    SELECT c.relkind INTO v_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'jobs';

    IF v_kind IS NULL THEN
        -- Case (a): no existing table, create it partitioned
        CREATE TABLE "jobs" (
            id                  BIGSERIAL,
            queue_name          TEXT          NOT NULL DEFAULT 'default',
            job_type            "JobType"     NOT NULL,
            priority            "JobPriority" NOT NULL DEFAULT 'normal',
            payload             JSONB         NOT NULL DEFAULT '{}',
            result              JSONB,
            metadata            JSONB                  DEFAULT '{}',
            status              "JobStatus"   NOT NULL DEFAULT 'pending',
            progress            INTEGER                DEFAULT 0,
            created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
            scheduled_for       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
            started_at          TIMESTAMPTZ(6),
            completed_at        TIMESTAMPTZ(6),
            attempt_count       INTEGER       NOT NULL DEFAULT 0,
            max_attempts        INTEGER       NOT NULL DEFAULT 3,
            retry_delay_seconds INTEGER                DEFAULT 60,
            last_error          JSONB,
            worker_id           TEXT,
            lease_expires_at    TIMESTAMPTZ(6),
            hard_timeout_at     TIMESTAMPTZ(6),
            processing_time_ms  INTEGER,
            wait_time_ms        INTEGER,
            manga_id            INTEGER,
            chapter_id          INTEGER,
            partition_key       TEXT          NOT NULL DEFAULT 'active',
            PRIMARY KEY (id, partition_key),
            CONSTRAINT jobs_manga_id_fkey   FOREIGN KEY (manga_id)   REFERENCES "Manga"(id)   ON DELETE SET NULL,
            CONSTRAINT jobs_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES "Chapter"(id) ON DELETE SET NULL
        ) PARTITION BY LIST (partition_key);

        CREATE TABLE "jobs_active"   PARTITION OF "jobs" FOR VALUES IN ('active');
        CREATE TABLE "jobs_archived" PARTITION OF "jobs" FOR VALUES IN ('archived');

        RAISE NOTICE 'Created partitioned `jobs` table with active/archived partitions';
    ELSIF v_kind = 'p' THEN
        -- Case (b): already partitioned, ensure partitions exist
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'jobs_active') THEN
            CREATE TABLE "jobs_active" PARTITION OF "jobs" FOR VALUES IN ('active');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'jobs_archived') THEN
            CREATE TABLE "jobs_archived" PARTITION OF "jobs" FOR VALUES IN ('archived');
        END IF;
        RAISE NOTICE '`jobs` is already partitioned; partitions verified';
    ELSIF v_kind = 'r' THEN
        -- Case (c): plain table; abort. Operator must drop or migrate manually.
        RAISE EXCEPTION
            '`jobs` exists as a plain (non-partitioned) table. This is the prisma db push footgun. '
            'To recover: (1) back up any data via `pg_dump -t jobs`; (2) `DROP TABLE jobs CASCADE`; '
            '(3) re-run this migration. See docs/migration/MIGRATION_AUDIT.md.';
    ELSE
        RAISE EXCEPTION
            '`jobs` exists as relkind=% which is neither table, partitioned table, nor missing. '
            'Manual investigation required.', v_kind;
    END IF;
END $$;

-- ============================================================================
-- 3. FlareSolverrConfig TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "FlareSolverrConfig" (
    id                     TEXT PRIMARY KEY DEFAULT 'default',
    enabled                BOOLEAN     NOT NULL DEFAULT true,
    url                    TEXT        NOT NULL DEFAULT 'http://localhost:8191/v1',
    timeout                INTEGER     NOT NULL DEFAULT 60000,
    "sessionTTL"           INTEGER     NOT NULL DEFAULT 1800000,
    "disableMedia"         BOOLEAN     NOT NULL DEFAULT true,
    "defaultWaitSecs"      INTEGER     NOT NULL DEFAULT 0,
    "metricsEnabled"       BOOLEAN     NOT NULL DEFAULT true,
    "metricsRetentionDays" INTEGER     NOT NULL DEFAULT 7,
    "hourlyRetentionDays"  INTEGER     NOT NULL DEFAULT 30,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- `autoStart` is added by 20251213_add_flaresolverr_autostart's ALTER TABLE;
-- we deliberately do NOT add it here so that migration's own SQL stays
-- meaningful when applied. (ALTER ADD COLUMN is not IF NOT EXISTS in that
-- migration, but it runs after this one and the column will not yet exist on
-- fresh installs.)

-- ============================================================================
-- 4. FlareSolverrMetrics + Hourly
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "FlareSolverrRequestType" AS ENUM (
        'HEALTH_CHECK',
        'FETCH_REQUEST',
        'SESSION_CREATE',
        'SESSION_DESTROY',
        'SESSION_LIST'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "FlareSolverrMetrics" (
    id               TEXT PRIMARY KEY,
    timestamp        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    healthy          BOOLEAN      NOT NULL,
    "responseTimeMs" INTEGER,
    version          TEXT,
    "sessionCount"   INTEGER      NOT NULL DEFAULT 0,
    "requestType"    "FlareSolverrRequestType" NOT NULL DEFAULT 'HEALTH_CHECK',
    success          BOOLEAN      NOT NULL,
    "errorMessage"   TEXT,
    hour             TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "FlareSolverrMetrics_timestamp_idx" ON "FlareSolverrMetrics"(timestamp);
CREATE INDEX IF NOT EXISTS "FlareSolverrMetrics_hour_idx"      ON "FlareSolverrMetrics"(hour);
CREATE INDEX IF NOT EXISTS "FlareSolverrMetrics_healthy_idx"   ON "FlareSolverrMetrics"(healthy);

CREATE TABLE IF NOT EXISTS "FlareSolverrMetricsHourly" (
    id                TEXT PRIMARY KEY,
    hour              TIMESTAMPTZ(6) NOT NULL,
    "totalRequests"   INTEGER NOT NULL DEFAULT 0,
    "successfulReqs"  INTEGER NOT NULL DEFAULT 0,
    "failedReqs"      INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "minResponseTime" INTEGER,
    "maxResponseTime" INTEGER,
    "p95ResponseTime" INTEGER,
    "uptimePercent"   DOUBLE PRECISION,
    "avgSessionCount" DOUBLE PRECISION,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlareSolverrMetricsHourly_hour_key" ON "FlareSolverrMetricsHourly"(hour);
CREATE INDEX IF NOT EXISTS "FlareSolverrMetricsHourly_hour_idx"        ON "FlareSolverrMetricsHourly"(hour);
