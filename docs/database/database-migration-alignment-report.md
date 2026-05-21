# Database Migration Alignment Report

*Generated: 2025-10-19*
*Status: Critical Issues Found*

## Executive Summary

The database and migration system have significant inconsistencies that need immediate attention. There are failed migrations, enum type mismatches, and missing tables.

---

## 🚨 Critical Issues

### 1. Failed Migration Records

**Issue**: The `20250925_redis_like_optimization` migration has 3 failed attempts in the `_prisma_migrations` table.

```sql
-- Failed attempts:
1. Started: 2025-10-18 20:25:33 - Error: relation "users" does not exist
2. Started: 2025-10-18 20:26:08 - Error: foreign key constraint type mismatch
3. Started: 2025-10-18 20:26:44 - Error: relation "manga" does not exist
```

**Impact**:
- Blocks new migrations from being applied
- Migration history is polluted
- Cache tables were never created

### 2. Enum Type Mismatch ⚠️ CRITICAL

**Issue**: schema.prisma and database have different enum conventions.

**Schema.prisma defines** (lowercase):
```prisma
enum JobStatus {
  pending
  active
  completed
  failed
  cancelled
  retrying
}

enum JobType {
  metadata_refresh
  metadata_update
  metadata_sync
  // ... etc
}

enum JobPriority {
  critical
  high
  normal
  low
}
```

**Database has** (UPPERCASE):
```sql
-- Current jobs table uses:
status: JobStatus (PENDING, ACTIVE, COMPLETED, FAILED, CANCELLED, RETRYING)
job_type: JobType (METADATA_REFRESH, METADATA_UPDATE, METADATA_SYNC, ...)
priority: JobPriority (CRITICAL, HIGH, NORMAL, LOW)
```

**Impact**:
- Prisma client generates wrong enum values
- Application code will break when using enums
- Insert/update operations will fail
- Both old (`job_status`) and new (`JobStatus`) types exist causing confusion

### 3. Missing Tables

**BackupContent**: Defined in schema but doesn't exist in database
- Referenced by `Backup.contents` relation
- Will cause relation errors

### 4. Table Name Casing Mismatches

| Schema.prisma | Database | Status |
|---------------|----------|--------|
| `BackupConfig` | `backup_config` | ❌ Mismatch |
| `QueueConfig` | `queue_config` | ❌ Mismatch |
| `Worker` | `workers` | ❌ Mismatch |

**Impact**: Prisma won't find these tables

### 5. Unapplied Migration Files

These migration files exist but were never applied:
- `20251018_fix_job_enum_types/migration.sql`
- `20251018213642_rename_job_status_enum/migration.sql`

**Note**: These appear to address the enum issues but never ran.

### 6. Missing Cache Infrastructure

The redis optimization migration was supposed to create:
- `cache_unified` - UNLOGGED cache table
- `jobs_volatile` - Volatile jobs table
- `sessions_cache` - Session cache
- `hot_data_cache` - Hot data cache
- Cache functions: `cache_set()`, `cache_get()`, `cache_del()`, etc.

**None of these exist.**

---

## 📊 Current State Summary

### Tables Present in Database
✅ Account, Backup, Chapter, Config, ConversionJob, KapowarrDownload, KapowarrSource, Library, Manga, Metadata, Notification, ParserCache, ReleaseBlocklist, Session, SystemEvent, User, VerificationToken, jobs, jobs_active, jobs_archived

### Tables Missing from Database
❌ BackupContent
❌ BackupConfig (exists as `backup_config`)
❌ QueueConfig (exists as `queue_config`)
❌ Worker (exists as `workers`)
❌ cache_unified, jobs_volatile, sessions_cache, hot_data_cache

### Enum Types in Database
```
- JobStatus, JobType, JobPriority (PascalCase - CURRENTLY USED)
- job_status, job_type, job_priority (lowercase - DEPRECATED)
```

---

## 🔧 Alignment Plan

### Phase 1: Clean Up Failed Migrations (IMMEDIATE)

**Action**: Remove failed migration records

```sql
-- Delete failed migration attempts
DELETE FROM _prisma_migrations
WHERE migration_name = '20250925_redis_like_optimization'
AND applied_steps_count = 0;
```

**Risk**: Low - these migrations never completed
**Outcome**: Clears migration history

### Phase 2: Fix Enum Mismatch (CRITICAL)

**Option A: Update Database to Match Schema** (RECOMMENDED)
- Convert database enums back to lowercase to match schema.prisma
- Simpler and safer
- Prisma expects lowercase

```sql
-- 1. Convert enum values back to lowercase
ALTER TYPE "JobStatus" RENAME VALUE 'PENDING' TO 'pending';
ALTER TYPE "JobStatus" RENAME VALUE 'ACTIVE' TO 'active';
-- ... etc for all values

-- 2. Rename types back to lowercase
ALTER TYPE "JobStatus" RENAME TO "job_status";
ALTER TYPE "JobType" RENAME TO "job_type";
ALTER TYPE "JobPriority" RENAME TO "job_priority";

-- 3. Drop old enum types if they exist
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS job_type CASCADE;
DROP TYPE IF EXISTS job_priority CASCADE;
```

**Option B: Update Schema to Match Database**
- Change schema.prisma enums to UPPERCASE
- More work throughout codebase
- Need to update all enum references in code

**Recommendation**: Option A (update database)

### Phase 3: Fix Table Names

**Action**: Add `@@map` directives to schema.prisma

```prisma
model BackupConfig {
  // ... fields
  @@map("backup_config")
}

model QueueConfig {
  // ... fields
  @@map("queue_config")
}

model Worker {
  // ... fields
  @@map("workers")
}
```

**Risk**: None - just tells Prisma the correct table name
**Outcome**: Prisma will find the tables

### Phase 4: Create Missing Tables

**BackupContent**: Run migration to create this table

```prisma
model BackupContent {
  id        Int         @id @default(autoincrement())
  backupId  Int
  itemType  String
  itemId    Int
  itemPath  String
  size      Int
  createdAt DateTime    @default(now())
  Backup    Backup      @relation(fields: [backupId], references: [id], onDelete: Cascade)

  @@index([backupId])
}
```

### Phase 5: Redis Optimization Tables (OPTIONAL)

**Decision needed**: Do we still want these cache tables?

If YES:
- Review and fix the migration
- Apply it properly

If NO:
- Delete the migration file
- Document decision

### Phase 6: Verification

```bash
# 1. Run Prisma validation
npx prisma validate

# 2. Check for drift
npx prisma migrate status

# 3. Generate fresh migration if needed
npx prisma migrate dev --create-only
```

---

## 🎯 Recommended Execution Order

1. **IMMEDIATE**: Clean up failed migrations
2. **CRITICAL**: Fix enum mismatch (choose Option A or B)
3. **HIGH**: Add @@map directives for table names
4. **MEDIUM**: Create BackupContent table
5. **LOW**: Decide on redis optimization tables
6. **VERIFY**: Run Prisma validation and checks

---

## ⚠️ Warnings

- **DO NOT** run `prisma migrate reset` - will lose data
- **DO NOT** manually edit both schema and DB simultaneously
- **BACKUP** database before any changes
- **TEST** in development first
- Consider the enum fix carefully - it affects all existing data

---

## 📝 Notes

- The enum mismatch is the most critical issue
- Jobs table currently works but Prisma client won't match
- Failed migrations should be cleaned first
- Cache tables are optional but migration is blocking

---

## Next Steps

1. Review this report
2. Choose enum fix strategy (Option A recommended)
3. Create backup
4. Execute Phase 1 (clean failed migrations)
5. Execute Phase 2 (fix enums)
6. Run verification
7. Generate new migration if needed
