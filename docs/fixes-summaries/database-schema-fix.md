# Database Schema Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Database Schema Fix

---
# Database Schema Fix

## Problem

The application was experiencing database errors related to schema inconsistencies between the Prisma schema and the actual database structure. Specifically, when initializing settings, the application would fail with:

```
Error initializing settings: PrismaClientKnownRequestError: 
Invalid `prisma.$executeRaw()` invocation:

Raw query failed. Code: `42703`. Message: `column "anilistEnabled" of relation "Settings" does not exist`
```

## Root Cause Analysis

After investigation, we discovered that the Settings table in the database was missing many columns that were defined in the Prisma schema. The database had a minimal version of the Settings table with only 19 columns, while the Prisma schema defined over 50 columns.

This issue was likely caused by:
1. An incomplete migration process
2. The 'remove_legacy_settings' migration, which was supposed to be run after migrating settings to a new configuration system, but may have run before all necessary columns were added

## Solution

We created a comprehensive fix that:

1. Adds all missing columns to the Settings table through a SQL script
2. Updates the settings initialization script to work with both old and new schemas
3. Provides a simple way to apply the fix through a shell script

### Fix Components

1. **SQL Schema Update Script**: `scripts/fix-settings-schema.sql`
   - Checks for each required column in the Settings table
   - Adds missing columns with appropriate default values
   - Uses SQL's IF NOT EXISTS condition to make the script idempotent (safe to run multiple times)

2. **Updated Settings Initialization**: `scripts/init-settings.mjs`
   - Tries to use the Prisma model first (which uses the schema definition)
   - Falls back to raw SQL if the Prisma model fails
   - Safely handles existing settings records

3. **Fix Script**: `scripts/fix-database.sh`
   - Runs the SQL schema update script
   - Initializes settings if needed
   - Provides a single command to apply all fixes

## How to Use

If you encounter database schema errors, run:

```bash
./scripts/fix-database.sh
```

This will:
1. Add all missing columns to the Settings table
2. Initialize default settings if none exist
3. Ensure the database schema matches the Prisma schema

## Prevention

To prevent similar issues in the future:

1. Always run Prisma migrations when the schema changes
2. When removing or replacing tables, ensure all data has been properly migrated
3. Use schema validation tools during application startup
4. Consider implementing schema version tracking

## Related Files

- `prisma/schema.prisma`: The Prisma schema definition
- `prisma/migrations/`: Migration history
- `scripts/fix-settings-schema.sql`: SQL script to add missing columns
- `scripts/init-settings.mjs`: Script to initialize settings
- `scripts/fix-database.sh`: Script to apply all fixes

## Future Improvements

For more robust database management:

1. Implement a database schema version check on application startup
2. Create a more comprehensive database health check tool
3. Consider using Prisma's introspection to verify schema compatibility
4. Add automatic backup before applying schema changes