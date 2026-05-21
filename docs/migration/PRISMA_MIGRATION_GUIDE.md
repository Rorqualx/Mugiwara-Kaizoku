# Prisma Types Migration Guide

## Overview

This guide explains how to use the migration script to enforce Prisma types throughout the codebase, removing all backwards compatibility layers and duplicate type definitions.

## What the Migration Does

The migration script (`scripts/migrate-to-prisma-types.ts`) performs the following transformations:

### 1. **Enum Value Updates** (351 changes detected)
- Converts all lowercase enum values to UPPERCASE format
- Examples:
  - `'pending'` → `'PENDING'`
  - `'completed'` → `'COMPLETED'`
  - `TaskStatus.pending` → `TaskStatus.PENDING`

### 2. **TRPC Usage Updates** (129 changes detected)
- Updates TRPC calls to v10+ syntax
- Examples:
  - `.query()` → `.useQuery()`
  - `.mutate()` → `.useMutation()`
  - `mutation.mutate()` → `mutation.mutateAsync()`

### 3. **Import Updates**
- Removes references to non-existent `canonical` types
- Updates imports to use `@prisma/client` directly
- Consolidates duplicate type definitions

### 4. **Type Reference Fixes**
- Updates component props to match Prisma model shapes
- Fixes `ExtendedMangaSearchResult` usage
- Removes backwards compatibility layers

## Usage

### Prerequisites

1. **Commit your changes** - The script checks for uncommitted changes
2. **Ensure TypeScript is installed** - Required for validation
3. **Verify Prisma schema exists** - Must have `prisma/schema.prisma`

### Commands

```bash
# Run a dry run to preview changes (recommended first step)
npm run migrate:types:dry

# Run the migration with automatic backup
npm run migrate:types

# Run the migration without backup (not recommended)
npm run migrate:types -- --no-backup

# Run with verbose output
npm run migrate:types -- --verbose

# Test the migration on sample files
npm run migrate:types:test

# Show help
npx tsx scripts/migrate-to-prisma-types.ts --help
```

## Migration Process

### Step 1: Dry Run
Always start with a dry run to preview changes:

```bash
npm run migrate:types:dry
```

This will:
- Show which files will be modified
- Display the number of changes per category
- Generate a report without modifying any files

### Step 2: Review Results
The dry run produces:
- Console output showing progress
- A JSON report file with detailed statistics
- Count of enum updates, TRPC updates, and import fixes

### Step 3: Run Migration
Once satisfied with the dry run results:

```bash
npm run migrate:types
```

This will:
- Create a backup in `.migration-backups/` directory
- Apply all transformations
- Save modified files
- Run a type check to validate changes

### Step 4: Verify Results
After migration:

1. **Check TypeScript errors**:
   ```bash
   npm run type-check
   ```

2. **Review the changes**:
   ```bash
   git diff
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Rollback

If you need to rollback the migration:

### Option 1: Use the backup (if created)
```bash
# The backup location is shown in the migration output
cp -r .migration-backups/backup-[timestamp]/src ./
```

### Option 2: Use Git
```bash
git checkout -- src/
```

## Migration Statistics

Based on the current codebase analysis:
- **Files to process**: 1,283
- **Files to modify**: 242
- **Enum values to update**: 351
- **TRPC calls to update**: 129
- **Estimated reduction in TypeScript errors**: ~500-800

## Common Issues and Solutions

### Issue: "Not in a git repository"
**Solution**: The script requires a git repository for safety. Initialize git or run from the repository root.

### Issue: "You have uncommitted changes"
**Solution**: Commit or stash your changes before running the migration.

### Issue: TypeScript errors after migration
**Solution**: Some errors may remain due to complex type issues. These need manual fixes:
- Component prop mismatches
- AsyncResult type parameters
- Missing type imports

### Issue: Build fails after migration
**Solution**: Run `npm run build:clean` to ensure a fresh build.

## What Needs Manual Attention

The migration script handles most transformations automatically, but some items need manual review:

1. **Complex type conversions** - Where types depend on runtime values
2. **Dynamic enum values** - Computed or template literal enum values
3. **Third-party library types** - External packages may need updates
4. **Test files** - May need additional updates for mocked values

## Best Practices

1. **Always run a dry-run first**
2. **Create a backup** (default behavior)
3. **Review changes** before committing
4. **Run tests** after migration
5. **Fix remaining TypeScript errors** manually if needed

## Next Steps After Migration

1. **Remove unused type files**:
   ```bash
   # Remove archive directories
   rm -rf src/types/__archive_*
   
   # Remove backup type files
   find src -name "*.types.bak" -delete
   ```

2. **Update documentation**:
   - Remove references to canonical types
   - Update type import examples
   - Update contribution guidelines

3. **Clean up dependencies**:
   ```bash
   # Remove unused type packages if any
   npm prune
   ```

## Support

If you encounter issues:
1. Check the migration report JSON file for details
2. Review the backup if changes need to be reverted
3. Manually fix any remaining type errors
4. Consider running the migration on smaller directories first

## Technical Details

The migration script uses:
- **AST-based transformations** - Not regex for safety
- **Pattern matching** - To identify enum usage
- **Incremental processing** - Files are processed one by one
- **Hash comparison** - To detect actual changes
- **Automatic backup** - Before any modifications

## Contributing

To improve the migration script:
1. Add new patterns to `ENUM_MAPPINGS`
2. Update transformation methods
3. Add test cases in `test-migration.ts`
4. Test thoroughly before committing