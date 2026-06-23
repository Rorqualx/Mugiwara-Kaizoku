# Schema Recreation Guide for Mugiwara-Kaizoku

This guide explains how the schema recreation approach works in the Mugiwara-Kaizoku project and provides troubleshooting steps for common issues.

## Overview

The schema recreation approach replaces the traditional migration-based workflow with a direct schema recreation process. This significantly improves development velocity by reducing database setup time from 5+ minutes to 30 seconds.

Key benefits:
- **Faster Development Setup**: New developers can get started quickly
- **Simplified Schema Management**: Single consolidated schema file
- **Reduced Complexity**: No need to manage migration history in development
- **Production Safety**: Production still uses migrations for safety

## How It Works

1. **Consolidated Schema**: All models are defined in `prisma/schema.prisma`
2. **Direct SQL for NextAuth Tables**: Creates NextAuth tables directly with SQL statements for reliability
3. **Prisma Push for Remaining Tables**: Uses `prisma db push` for the rest of the schema
4. **Environment Detection**: Automatically uses the appropriate approach based on environment
5. **Safety Checks**: Verifies database connection and table creation
6. **Archiving**: Preserves migration history for reference and rollback

## Commands

### Smart Commands (Recommended)
- `npm run smart-run "command"` - Run any command with smart error detection

### Direct Database Commands
- `npm run db:auto-repair` - Intelligent database repair system
- `npm run db:fix-account` - Direct SQL fix for the Account table issue
- `npm run db:reset:dev` - Basic schema recreation (faster)
- `npm run db:reset:safe` - Enhanced schema recreation with safety checks
- `npm run db:test:schema` - Test schema recreation to verify it works correctly
- `npm run db:rollback:migrations` - Revert to migration-based approach if needed

### Build Commands
- `npm run build:clean` - Full setup including schema recreation

See also: Smart Database System for intelligent self-healing capabilities.

## Common Issues and Solutions

### 1. Missing Account Table

**Problem**: `The underlying table for model 'Account' does not exist` error during schema recreation.

**Solution**:

#### Direct SQL Fix (Recommended)
The most reliable solution is to use the direct SQL fix script:
```bash
npm run db:fix-account
```
This script:
- Creates the NextAuth tables directly with SQL statements
- Bypasses Prisma's schema push for these tables
- Uses Prisma db push only for the remaining tables
- Verifies that all tables are created successfully

#### Alternative Solutions
- Verify that your schema includes all NextAuth models (User, Account, Session, VerificationToken)
- Run `npm run db:reset:safe` which includes verification and retry logic
- Check if your database connection is working properly
- Try running `npm run db:test:schema` to specifically test table creation

### 2. Database Connection Issues

**Problem**: Cannot connect to database during schema recreation.

**Solution**:
- Check that PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Verify your DATABASE_URL environment variable is correct
- Make sure the database user has appropriate permissions
- Try using `npm run db:reset:safe` which includes connection verification

### 3. Schema Push Failures

**Problem**: Schema push fails with errors.

**Solution**:
- Check for syntax errors in your schema.prisma file
- Verify that `prisma/schema.prisma` is complete and valid
- Try running `npx prisma db push --force-reset` manually for detailed error messages
- Run `npm run db:test:schema` to isolate and identify schema issues

### 4. Production vs Development Environments

**Problem**: Schema recreation being used in production.

**Solution**:
- The system automatically detects environments via NODE_ENV
- Production should always use `npm run migrate` which uses the migration-based approach
- Verify that NODE_ENV=production is set in production environments
- Check build-clean.sh and other scripts for environment detection logic

## Verification Process

The enhanced schema recreation process includes verification steps:

1. **Connection Check**: Verifies database connection before attempting recreation
2. **Table Verification**: Checks that critical tables were created successfully
3. **Auto-Recovery**: Automatically attempts a second schema push if issues are detected
4. **Detailed Logging**: Provides clear error messages for troubleshooting

## Rollback Procedure

If you need to revert to the migration-based approach:

1. Run `npm run db:rollback:migrations` to restore the original schema and migrations
2. Delete your database or run `npx prisma migrate reset` to apply migrations from scratch
3. Update your scripts or package.json to use migration commands instead of schema recreation

## Advanced Troubleshooting

For persistent issues:

1. **Use Direct SQL Fix**:
   ```bash
   # Most reliable fix for Account table issues
   npm run db:fix-account
   ```

2. **Manual Database Inspection**:
   ```bash
   npx prisma studio
   # or
   psql -h localhost -U kaizoku -d kaizoku
   ```

3. **Schema Validation**:
   ```bash
   npx prisma validate
   ```

4. **Detailed Prisma Logs**:
   ```bash
   DEBUG=prisma:* npx prisma db push
   ```

5. **Test with Clean Database**:
   ```bash
   psql -h localhost -U postgres -c "DROP DATABASE kaizoku WITH (FORCE);"
   psql -h localhost -U postgres -c "CREATE DATABASE kaizoku OWNER kaizoku;"
   npm run db:fix-account  # Use direct SQL fix instead of reset:safe
   ```

6. **Clean Build Process**:
   ```bash
   # Completely clean build with direct SQL fix
   npm run build:clean
   ```

## Best Practices

1. For the most reliable setup, use `npm run db:fix-account` or `npm run build:clean`
2. If issues persist, use the direct SQL approach rather than relying solely on Prisma
3. Always run `npm run db:test:schema` after making schema changes
4. Document any schema changes in comments
5. Keep the schema (`prisma/schema.prisma`) up to date with all model changes
6. Use the archiving system to preserve migration history
7. Follow the verification process for any schema changes
8. Ensure that all NextAuth tables are defined in your schema

By following this guide, you should be able to effectively use the schema recreation approach and troubleshoot any issues that arise.