# API Client Base Classes Consolidation Plan

*Status: Active*  
*Author: Architecture Team*  
*Canonical: Yes*  
*Date: January 2025*

## Overview

Plan to consolidate 4 similar API client base classes that contain ~435 lines of duplicate code. This consolidation will create a single source of truth for HTTP operations, error handling, and AsyncResult patterns.

---

## Current State Analysis

### Existing Base Classes

1. **ApiClient** (`src/server/base/ApiClient.ts`) - 716 lines
   - Full HTTP operations (GET, POST, PUT, DELETE, PATCH)
   - Rate limiting, caching, auth management
   - AsyncResult pattern support
   - Connection testing and disposal

2. **DownloadClient** (`src/server/base/DownloadClient.ts`) - 240 lines
   - Extends ApiClient
   - Download-specific operations
   - Batch operations

3. **MetadataClient** (`src/server/base/MetadataClient.ts`) - 185 lines
   - Standalone implementation
   - No HTTP client integration
   - Abstract metadata operations

4. **MetadataProvider** (`src/server/base/MetadataProvider.ts`) - 344 lines
   - Extends ApiClient
   - Metadata-specific operations
   - Domain type conversions

### Identified Duplication Patterns

- **AsyncResult Unwrapping**: 188 instances of `if (isSuccess(result)) return result.data; if (isError(result)) throw result.error;`
- **Error Transformation**: Multiple `transformError` implementations
- **Connection Management**: Repeated connection status tracking
- **HTTP Methods**: Similar request/response handling patterns
- **Resource Disposal**: Duplicate cleanup logic

---

## Proposed Architecture

```
BaseHttpClient (New Root Class)
├── Core HTTP operations
├── Error handling utilities
├── AsyncResult template methods
├── Connection management
├── Rate limiting & caching
└── Resource disposal

    ↓
    
ApiClient (Refactored, extends BaseHttpClient)
├── API-specific operations
└── Provider-specific methods

    ↓           ↓
    
DownloadClient   MetadataProvider
(extends ApiClient)
```

---

## Migration Strategy (AST-Based Forward Migration)

### Philosophy
- **NO backward compatibility layers** - Clean break, fix forward
- **AST-based migration** for accuracy and consistency
- **Test-first approach** with comprehensive validation
- **Rollback capability** at each phase
- **Post-migration TypeScript cleanup**

### Phase 1: Preparation & Analysis

#### 1.1 Create AST Migration Tool
```typescript
// scripts/migrate-api-clients.ts
import ts from 'typescript';
import { Project, SourceFile } from 'ts-morph';

class ApiClientMigrator {
  private project: Project;
  private affectedFiles: Set<string> = new Set();
  
  async analyze(): Promise<MigrationAnalysis> {
    // Scan for all files importing base clients
    // Identify method usage patterns
    // Map inheritance chains
    // Return detailed analysis
  }
  
  async migrate(dryRun: boolean = true): Promise<MigrationResult> {
    // Transform imports
    // Update class hierarchies
    // Refactor method calls
    // Handle type parameters
  }
  
  async validate(): Promise<ValidationResult> {
    // Run TypeScript compiler
    // Check for type errors
    // Validate method signatures
  }
}
```

#### 1.2 Dependency Mapping
```bash
# Find all files using base clients
grep -r "extends ApiClient" --include="*.ts" src/
grep -r "extends DownloadClient" --include="*.ts" src/
grep -r "extends MetadataClient" --include="*.ts" src/
grep -r "extends MetadataProvider" --include="*.ts" src/

# Create dependency graph
npx madge --circular --extensions ts src/server/base/
```

#### 1.3 Test Coverage Baseline
```bash
# Capture current test coverage
pnpm test --coverage > coverage-baseline.txt

# Create integration tests for critical paths
pnpm test:integration --filter="*client*"
```

### Phase 2: Implementation

#### 2.1 Create New Base Class
```typescript
// src/server/base/BaseHttpClient.ts
export abstract class BaseHttpClient<TResource = unknown, TError extends Error = Error> {
  // Consolidated implementation
  protected abstract getServiceName(): string;
  
  // Template method for AsyncResult unwrapping
  protected unwrapAsyncResult<T>(
    asyncFn: () => Promise<AsyncResult<T, TError>>,
    methodName: string
  ): Promise<T> {
    // Single source of truth
  }
  
  // Unified error transformation
  protected transformError(
    error: unknown, 
    context: ErrorContext
  ): TError {
    // Centralized error handling
  }
}
```

#### 2.2 AST-Based Migration Execution
```typescript
// Migration script execution
async function executeMigration() {
  const migrator = new ApiClientMigrator();
  
  // Step 1: Dry run analysis
  const analysis = await migrator.analyze();
  console.log(`Found ${analysis.affectedFiles.length} files to migrate`);
  
  // Step 2: Create backup
  await createBackup(analysis.affectedFiles);
  
  // Step 3: Execute migration
  const result = await migrator.migrate(false);
  
  // Step 4: Validate
  const validation = await migrator.validate();
  if (!validation.success) {
    await rollback();
    throw new Error('Migration validation failed');
  }
  
  // Step 5: Run tests
  const testResult = await runTests();
  if (!testResult.success) {
    await rollback();
    throw new Error('Tests failed after migration');
  }
}
```

### Phase 3: Rollback Strategy

#### 3.1 Backup Mechanism
```bash
#!/bin/bash
# scripts/backup-before-migration.sh

BACKUP_DIR="migration-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup affected files
cp -r src/server/base $BACKUP_DIR/
cp -r src/server/services/download $BACKUP_DIR/
cp -r src/server/adapters $BACKUP_DIR/

# Create git stash as additional backup
git stash push -m "Pre-migration backup"
```

#### 3.2 Rollback Script
```bash
#!/bin/bash
# scripts/rollback-migration.sh

if [ -z "$1" ]; then
  echo "Usage: ./rollback-migration.sh <backup-dir>"
  exit 1
fi

BACKUP_DIR=$1

# Restore files
cp -r $BACKUP_DIR/* src/

# Run type check
pnpm type-check

# Run tests
pnpm test
```

### Phase 4: Migration Execution

#### 4.1 Pre-Migration Checklist
- [ ] All tests passing
- [ ] TypeScript compilation clean
- [ ] Backup created
- [ ] Migration script tested in dry-run mode
- [ ] Team notified of migration window

#### 4.2 Migration Steps
```bash
# 1. Create feature branch
git checkout -b feat/api-client-consolidation

# 2. Run migration analysis
pnpm tsx scripts/migrate-api-clients.ts --analyze

# 3. Create backup
./scripts/backup-before-migration.sh

# 4. Execute migration
pnpm tsx scripts/migrate-api-clients.ts --execute

# 5. Run type check
pnpm type-check

# 6. Fix type errors
pnpm tsx scripts/fix-type-errors-post-migration.ts

# 7. Run tests
pnpm test

# 8. Commit if successful
git add -A
git commit -m "refactor: Consolidate API client base classes"
```

### Phase 5: Post-Migration Cleanup

#### 5.1 TypeScript Error Resolution
```typescript
// scripts/fix-type-errors-post-migration.ts
async function fixTypeErrors() {
  const errors = await getTypeScriptErrors();
  
  for (const error of errors) {
    switch (error.code) {
      case 2339: // Property does not exist
        await fixMissingProperty(error);
        break;
      case 2345: // Argument type mismatch
        await fixTypeMismatch(error);
        break;
      case 2741: // Missing properties
        await fixMissingProperties(error);
        break;
    }
  }
}
```

#### 5.2 Remove Dead Code
```bash
# Find and remove unused imports
npx eslint --fix src/ --rule 'unused-imports/no-unused-imports: error'

# Find and remove unused methods
npx ts-prune --project tsconfig.json

# Remove old base classes after verification
rm src/server/base/MetadataClient.ts.deprecated
```

#### 5.3 Documentation Updates
- Update architecture diagrams
- Update API documentation
- Create migration guide for team
- Update TypeScript patterns guide

---

## Success Metrics

### Quantitative
- **Code Reduction**: ~435 lines eliminated
- **File Count**: 4 base classes → 2 base classes
- **Type Errors**: 0 after migration
- **Test Coverage**: Maintained or improved
- **Build Time**: No significant increase

### Qualitative
- Single source of truth for HTTP operations
- Consistent error handling across all clients
- Simplified maintenance and debugging
- Clearer inheritance hierarchy

---

## Risk Assessment & Mitigation

### Risks
1. **Breaking Changes**: Existing code may break
   - *Mitigation*: AST analysis identifies all usage points
   
2. **Type Mismatches**: New signatures may not match
   - *Mitigation*: TypeScript compiler validation + automated fixes
   
3. **Runtime Failures**: Behavioral changes
   - *Mitigation*: Comprehensive test suite + integration tests
   
4. **Performance Impact**: New abstraction overhead
   - *Mitigation*: Benchmark critical paths before/after

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Preparation | 1 day | AST tool development, analysis |
| Implementation | 2 days | Base class creation, migration script |
| Testing | 1 day | Test execution, validation |
| Cleanup | 1 day | Type fixes, dead code removal |
| **Total** | **5 days** | **Full migration** |

---

## Post-Migration Validation

### Automated Checks
```bash
#!/bin/bash
# scripts/validate-migration.sh

echo "Running post-migration validation..."

# 1. TypeScript compilation
echo "Checking TypeScript..."
pnpm type-check || exit 1

# 2. Unit tests
echo "Running unit tests..."
pnpm test || exit 1

# 3. Integration tests
echo "Running integration tests..."
pnpm test:integration || exit 1

# 4. Lint checks
echo "Running linters..."
pnpm lint || exit 1

# 5. Build verification
echo "Verifying build..."
pnpm build:clean || exit 1

echo "✅ All validation checks passed!"
```

### Manual Verification
- [ ] API client functionality works
- [ ] Download clients connect properly
- [ ] Metadata providers fetch data
- [ ] Error handling behaves correctly
- [ ] Rate limiting still functions
- [ ] Caching works as expected

---

## Lessons for Future Migrations

1. **AST-based migrations** are more reliable than regex/manual
2. **Test-first** approach catches issues early
3. **No backward compatibility** = cleaner codebase
4. **Automated type fixing** saves significant time
5. **Comprehensive backups** enable confident changes

---

*Last Updated: January 2025*  
*Next Review: Post-migration retrospective*