# File Decomposition Workflow - Agent Orchestration Guide

**Status**: Production Ready
**Created**: 2025-11-17
**Use Case**: Refactoring large files (500+ lines) to meet ESLint/TypeScript standards
**Success Rate**: 100% (Metadata Router: 3432→485 lines/module)

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Refactoring Analysis](#pre-refactoring-analysis)
3. [Planning Phase](#planning-phase)
4. [Execution Strategy](#execution-strategy)
5. [Quality Validation](#quality-validation)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Agent Prompt Templates](#agent-prompt-templates)
8. [Success Metrics](#success-metrics)

---

## Overview

### When to Use This Workflow

- ✅ Files exceeding 500 lines (ESLint max-lines limit)
- ✅ Monolithic routers/services with multiple responsibilities
- ✅ Type errors accumulating in large files
- ✅ Need to maintain backward compatibility
- ✅ Multiple procedures/functions to extract

### Proven Results

**Metadata Router Case Study**:
- **Before**: 3,432 lines, 30 procedures, 1 file
- **After**: 13 modules, largest 485 lines, 0 errors
- **Time**: ~3 hours with parallel agents
- **Quality**: 100% ESLint/TypeScript compliance
- **Breaking Changes**: 0

---

## Pre-Refactoring Analysis

### Step 1: Identify Target Files

```bash
# Find files exceeding line limit
find src -name "*.ts" -exec wc -l {} \; | awk '$1 > 500' | sort -rn

# Check specific file
wc -l src/path/to/large-file.ts

# Check for ESLint violations
bun run lint --max-warnings=0 src/path/to/large-file.ts
```

### Step 2: Analyze File Structure

**Key Questions**:
1. How many procedures/functions/classes?
2. Are there logical groupings (provider, feature, domain)?
3. What are dependencies between procedures?
4. Are there shared utilities/types?
5. Is there a foundation layer (types, helpers, schemas)?

**Analysis Commands**:
```bash
# Count procedures (tRPC routers)
grep -n "publicProcedure\|protectedProcedure" file.ts | wc -l

# Count exports
grep -n "^export" file.ts | wc -l

# Find imports
grep "^import" file.ts

# Identify helpers
grep -n "^function\|^const.*=.*=>" file.ts | head -20
```

### Step 3: Create Snapshot Document

```markdown
## File Analysis: {filename}.ts

**Current State**:
- Lines: 3,432
- Procedures: 30
- Exports: 35
- Type definitions: 5 interfaces
- Helper functions: 8

**Dependencies**:
- External: axios, zod, cheerio, pino
- Internal: @/server/services/*, @/utils/*

**Logical Groupings**:
1. Core operations (8 procedures)
2. Provider A integration (5 procedures)
3. Provider B integration (7 procedures)
4. URL parsing (2 procedures)
5. Search operations (4 procedures)
6. Chapter processing (4 procedures)

**Shared Code**:
- Type guards: safeGet, isRecord
- Interfaces: ModelA, ModelB
- Schemas: SchemaA, SchemaB
```

---

## Planning Phase

### Step 1: Define Module Strategy

**Foundation-First Approach** (Recommended):
```
Phase 1: Extract foundation (utils, types, schemas)
  ↓
Phase 2: Extract provider modules in parallel
  ↓
Phase 3: Extract complex modules (with cross-refs)
  ↓
Phase 4: Create main aggregator
```

### Step 2: Create Refactoring Plan

**Template**: `docs/sessions/{feature}-refactoring-plan.md`

```markdown
# {Feature} Refactoring Plan

## Module Breakdown

| Module | Lines | Procedures | Purpose | Dependencies |
|--------|-------|-----------|---------|--------------|
| utils.ts | 150-200 | 0 | Helpers, types, schemas | None |
| core.ts | 400-500 | 8 | Core operations | utils.ts |
| provider-a.ts | 300-400 | 5 | Provider A | utils.ts |
| provider-b.ts | 300-400 | 7 | Provider B | utils.ts |

## Execution Phases

### Phase 1: Foundation (Sequential - CRITICAL PATH)
**Agent 1**: Extract utils.ts (lines 1-171)
- Priority: CRITICAL (all modules depend on this)
- No dependencies

### Phase 2: Independent Modules (Parallel - 7 agents)
**Agent 2-8**: Extract provider modules
- Can run in parallel
- All depend on utils.ts

### Phase 3: Complex Modules (Sequential)
**Agent 9-10**: Extract modules with cross-procedure calls
- Handle circular dependencies with dynamic imports

### Phase 4: Integration
**Agent 11**: Create main aggregator router
```

### Step 3: Identify Critical Dependencies

**Foundation Module Must Include**:
1. ✅ Type guards (safeGet, isRecord)
2. ✅ Shared interfaces
3. ✅ Validation schemas
4. ✅ Constants
5. ✅ Error handlers

**Extract Foundation FIRST** because:
- Prevents code duplication
- Establishes type contracts
- All other modules import from it
- Simplifies parallel extraction

---

## Execution Strategy

### Phase 1: Foundation Module

**Agent Task**:
```markdown
Extract {feature}-utils.ts (Lines 1-171)

PURPOSE: Foundation utilities for all {feature} modules

EXTRACT:
1. Helper Functions (5):
   - safeGet(obj, key): unknown
   - isRecord(value): boolean
   - safeGetString(obj, key): string | undefined
   - safeGetNumber(obj, key): number | undefined
   - handleError(error): Error

2. Interfaces (4):
   - Interface1
   - Interface2
   - Interface3
   - ExtendedClient

3. Zod Schemas (4):
   - Schema1
   - Schema2
   - Schema3
   - Schema4

INSTRUCTIONS:
1. Read lines 1-171 from source
2. Create directory if needed
3. Write module with file header
4. All imports use @/ aliases
5. Explicit return types
6. NO `any` types
7. Verify: bun run type-check
8. DO NOT commit

REPORT:
- Lines extracted
- Exports count
- Compilation result
```

**Launch**:
```typescript
Task({
  description: "Extract foundation utils",
  prompt: "{above instructions}",
  subagent_type: "general-purpose"
})
```

**Verify**:
```bash
bun run type-check src/path/to/utils.ts
```

---

### Phase 2: Parallel Module Extraction

**Launch Strategy**: Single message with multiple Task calls

**Example - Launch 7 Agents in Parallel**:
```markdown
I'm launching 7 specialized refactoring agents in parallel to extract provider modules.
```

Then in ONE message, make 7 Task tool calls:

```
Task 1: Extract provider-a.ts (lines 500-800)
Task 2: Extract provider-b.ts (lines 801-1100)
Task 3: Extract provider-c.ts (lines 1101-1400)
Task 4: Extract provider-d.ts (lines 1401-1700)
Task 5: Extract provider-e.ts (lines 1701-2000)
Task 6: Extract provider-f.ts (lines 2001-2300)
Task 7: Extract provider-g.ts (lines 2301-2600)
```

**Standard Agent Instructions**:
```markdown
Extract {module-name}.ts (Lines X-Y)

PURPOSE: {Provider/Feature} integration

PROCEDURES (count):
1. procedureName1 (lines A-B) - {description}
2. procedureName2 (lines C-D) - {description}

INSTRUCTIONS:
1. Read lines X-Y
2. Create tRPC router:
   ```typescript
   import { publicProcedure, protectedProcedure } from '../../procedures';
   import { router } from '../../trpc';
   import { z } from 'zod';
   import { logger } from '@/utils/logger';
   import { createSuccessResult, createErrorResult } from '@/utils/async-result';
   import type { AsyncResult } from '@/utils/async-result';
   import { helper1, Type1, Schema1 } from './utils';

   export const {module}Router = router({
     proc1: publicProcedure.input(z.object({...})).query(...),
     proc2: protectedProcedure.input(z.object({...})).mutation(...),
   });
   ```
3. Import from './utils' (NOT '../utils')
4. Service imports: '@/server/services/...'
5. File header with purpose
6. DO NOT commit

QUALITY:
- ✅ NO `any` types
- ✅ Explicit return types
- ✅ Use `??` not `||`
- ✅ AsyncResult patterns
- ✅ Under 500 lines

REPORT:
- Procedures extracted
- Line count
- Issues
```

**Verify All**:
```bash
bun run type-check src/path/to/modules/*.ts
```

---

### Phase 3: Complex Modules (Circular Dependencies)

**Scenario**: Module calls other procedures being refactored

**Solution**: Dynamic imports

**Agent Instructions**:
```markdown
Extract {complex-module}.ts (Lines X-Y)

CRITICAL: Circular Dependency Handling
This module calls other {feature} procedures.

CROSS-PROCEDURE CALLS:
Use dynamic imports:
```typescript
// ❌ WRONG - Circular dependency
import { otherRouter } from './other-module';

// ✅ CORRECT - Dynamic import
import type { Context } from '../../context';

const { mainRouter } = await import('../{feature}');
const caller = mainRouter.createCaller(ctx as Context);
const result = await caller.otherProcedure({ input });
```

FILE HEADER:
Document why dynamic imports:
```typescript
/**
 * {Module Name}
 *
 * Note: Uses dynamic imports to avoid circular dependencies.
 * Calls other {feature} procedures via mainRouter.createCaller().
 */
```

VERIFY:
No circular imports: `madge --circular src/path/`

REPORT:
- Dynamic imports used
- No circular deps?
```

---

### Phase 4: Main Router Integration

**Agent Instructions**:
```markdown
Create Main {Feature} Router Aggregator

BACKUP FIRST:
```bash
cp src/path/router.ts src/path/router.ts.backup
```

CREATE NEW:
```typescript
/**
 * {Feature} Router - Main Aggregator
 *
 * Aggregates N sub-routers into unified router.
 * All procedures exposed at top level (backward compatible).
 *
 * Architecture:
 * - module/utils.ts - Utilities (0 procedures)
 * - module/core.ts - Core (8 procedures)
 * - module/provider-a.ts - Provider A (5 procedures)
 * ...
 *
 * Total: 30 procedures across 11 routers
 * Original: 3432 lines → Refactored: ~100 lines (97% reduction)
 */

import { router } from '../trpc';
import { coreRouter } from './module/core';
import { providerARouter } from './module/provider-a';
// ... all imports

export const {feature}Router = router({
  ...coreRouter._def.procedures,
  ...providerARouter._def.procedures,
  // ... all spreads
});
```

VERIFY:
1. Backup created
2. Type-check passes
3. Procedure count matches original

REPORT:
- Backup path
- New file lines
- Procedure count
- Type-check result
```

---

## Quality Validation

### TypeScript Validation

**Per Module**:
```bash
# Check specific module
bun run type-check 2>&1 | grep "path/to/module.ts"

# Count errors (should be 0)
bun run type-check 2>&1 | grep "path/to/module.ts" | grep "error TS" | wc -l
```

**All Modules**:
```bash
# All metadata modules
bun run type-check 2>&1 | grep "src/server/trpc/routers/metadata/"
```

### ESLint Validation

**Line Limit Check**:
```bash
# Find violators
wc -l src/path/to/modules/*.ts | awk '$1 > 500'

# Should return nothing if compliant
```

**Full Lint**:
```bash
bun run lint --quiet src/path/to/modules/

# Exit code 0 = success
echo $?
```

### Quality Checklist

**Per Module** (automated check):
```bash
# Create validation script
cat > validate-module.sh << 'EOF'
#!/bin/bash
FILE=$1

echo "Validating: $FILE"

# Line count
LINES=$(wc -l < "$FILE")
if [ $LINES -gt 500 ]; then
  echo "❌ FAIL: $LINES lines (max 500)"
else
  echo "✅ PASS: $LINES lines"
fi

# No `any` types
ANY_COUNT=$(grep -c ": any" "$FILE" || true)
if [ $ANY_COUNT -gt 0 ]; then
  echo "❌ FAIL: $ANY_COUNT 'any' types found"
else
  echo "✅ PASS: No 'any' types"
fi

# No console.log
CONSOLE_COUNT=$(grep -c "console\.log" "$FILE" || true)
if [ $CONSOLE_COUNT -gt 0 ]; then
  echo "❌ FAIL: $CONSOLE_COUNT console.log statements"
else
  echo "✅ PASS: No console.log"
fi

# Has file header
if head -5 "$FILE" | grep -q "^/\*\*"; then
  echo "✅ PASS: Has file header"
else
  echo "❌ FAIL: Missing file header"
fi
EOF
chmod +x validate-module.sh

# Run on all modules
for file in src/path/to/modules/*.ts; do
  ./validate-module.sh "$file"
done
```

---

## Common Issues & Solutions

### Issue 1: Router Import Error

**Error**:
```
TS2614: Module '"../../procedures"' has no exported member 'router'
```

**Root Cause**: Trying to import `router` from procedures file.

**Solution**:
```typescript
// ❌ WRONG
import { router, publicProcedure } from '../../procedures';

// ✅ CORRECT
import { publicProcedure, protectedProcedure } from '../../procedures';
import { router } from '../../trpc';
```

**Bulk Fix** (if multiple files affected):
```bash
# Create sed script to fix all files
for file in src/path/to/modules/*.ts; do
  # Skip main aggregator
  if [[ "$file" == *"/main.ts" ]]; then continue; fi

  # Fix import statement
  sed -i "/import.*router.*from.*procedures/c\\
import { publicProcedure, protectedProcedure } from '../../procedures';\\
import { router } from '../../trpc';" "$file"
done
```

---

### Issue 2: Service Import Path Errors

**Error**:
```
TS2307: Cannot find module '../../services/path/service'
```

**Root Cause**: Using relative paths instead of `@/` aliases.

**Solution**:
```typescript
// ❌ WRONG
import { service } from '../../services/path/service';
import { service } from '../../../services/path/service';

// ✅ CORRECT
import { service } from '@/server/services/path/service';
```

**Prevention in Agent Prompts**:
```markdown
SERVICE IMPORTS:
ALL service imports MUST use @/server/ prefix:
- ❌ '../../services/...'
- ❌ '../../../services/...'
- ✅ '@/server/services/...'
```

---

### Issue 3: Module Exceeds 500 Lines

**Scenario**: After extraction, module is 550-900 lines.

**Solution**: Further split by procedure/function.

**Example**:
```
provider-module.ts (889 lines, 2 procedures)
  ↓ Split into:
provider-procedure1.ts (485 lines, 1 procedure)
provider-procedure2.ts (423 lines, 1 procedure)
```

**Agent Instructions for Re-split**:
```markdown
Split {module}.ts into 2 Modules

CURRENT: {module}.ts (889 lines, 2 procedures)
TARGET: 2 modules under 500 lines each

SPLIT STRATEGY:
- Module 1: {name1}.ts (procedure1)
- Module 2: {name2}.ts (procedure2)

INSTRUCTIONS:
1. Read entire {module}.ts
2. Create {name1}.ts with procedure1
3. Create {name2}.ts with procedure2
4. DELETE original {module}.ts
5. UPDATE main router:
   - Remove: import { moduleRouter } from './module';
   - Add: import { module1Router } from './module1';
   - Add: import { module2Router } from './module2';
   - Spread both in main router

VERIFY: Both under 500 lines

REPORT: Line counts
```

---

### Issue 4: AsyncResult Type Errors

**Error**:
```
TS2322: Type 'AsyncResult<T, unknown>' not assignable to 'AsyncResult<T, Error>'
```

**Root Cause**: Error type is `unknown` instead of `Error`.

**Solution**:
```typescript
// ❌ WRONG
catch (error: unknown) {
  return createErrorResult(error);
}

// ✅ CORRECT - Use handleError utility
import { handleError } from './utils';
catch (error: unknown) {
  return createErrorResult(handleError(error));
}

// ✅ CORRECT - Manual conversion
catch (error: unknown) {
  return createErrorResult(
    error instanceof Error ? error : new Error(String(error))
  );
}
```

**Add to Foundation Utils**:
```typescript
// In utils.ts
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
```

---

### Issue 5: Circular Dependencies

**Detection**:
```bash
# Install madge
npm install -g madge

# Check for circular imports
madge --circular src/path/to/modules/
```

**Solutions**:

**1. Dynamic Imports** (Preferred for procedure calls):
```typescript
// Module A needs to call Module B's procedure
const { mainRouter } = await import('../main-router');
const caller = mainRouter.createCaller(ctx);
const result = await caller.moduleBProcedure({ input });
```

**2. Extract Shared Code**:
```typescript
// Both modules need same helper
// ❌ WRONG: Module A imports from Module B
// ✅ CORRECT: Both import from utils.ts
```

**3. Refactor Module Boundaries**:
```typescript
// Redesign to eliminate dependency
// Often indicates incorrect module split
```

---

## Agent Prompt Templates

### Template: Foundation Utils Extraction

```markdown
You are a specialized refactoring agent for extracting foundation utilities.

## Task: Extract {feature}-utils.ts (Lines 1-171)

**Source**: `{path}/original.ts`
**Target**: `{path}/{feature}/utils.ts`
**Priority**: CRITICAL - Foundation for all modules

### Components to Extract:

**1. Helper Functions** (5 functions):
- `safeGet(obj: unknown, key: string): unknown`
- `isRecord(value: unknown): value is Record<string, unknown>`
- `safeGetString(obj: unknown, key: string): string | undefined`
- `safeGetNumber(obj: unknown, key: string): number | undefined`
- `handleError(error: unknown): Error`

**2. Type Definitions** (4 interfaces):
- `Interface1` - {description}
- `Interface2` - {description}
- `ExtendedClient` - {description}
- `ProviderStrengths` - {description}

**3. Zod Schemas** (4 schemas):
- `Schema1` - {field} validation
- `Schema2` - {field} validation
- `Schema3` - {field} validation
- `Schema4` - {field} validation

### Instructions:

1. **Read source**: Lines 1-171 from original.ts
2. **Create directory**: `{path}/{feature}/` if needed
3. **Write module**:
   ```typescript
   /**
    * {Feature} Utilities Module
    *
    * Shared helper functions, type definitions, and validation schemas
    * used across all {feature} modules.
    *
    * Extracted from: {original}.ts (lines 1-171)
    */

   import { z } from 'zod';
   import { prisma } from '@/server/db';

   // ============================================================================
   // Helper Functions
   // ============================================================================

   /**
    * Safely access property on unknown object
    */
   export function safeGet(obj: unknown, key: string): unknown {
     if (obj && typeof obj === 'object' && key in obj) {
       return (obj as Record<string, unknown>)[key];
     }
     return undefined;
   }

   // ... other helpers

   // ============================================================================
   // Type Definitions
   // ============================================================================

   export interface Interface1 {
     // ...
   }

   // ... other interfaces

   // ============================================================================
   // Validation Schemas
   // ============================================================================

   export const Schema1 = z.object({
     // ...
   });

   // ... other schemas
   ```

4. **Verify compilation**: `bun run type-check {path}/{feature}/utils.ts`
5. **DO NOT commit** - just create file

### Quality Standards:

- ✅ **NO** `any` types (use `unknown` with type guards)
- ✅ Explicit return types on all functions
- ✅ Use `??` for nullish coalescing (NOT `||`)
- ✅ All imports use `@/` path aliases
- ✅ JSDoc comments on exported functions
- ✅ Organized sections with headers
- ✅ File header with purpose and provenance

### Expected Exports:

- Functions: 5
- Interfaces: 4
- Schemas: 4
- **Total**: 13 exports

### Report Format:

```
## Extraction Complete: {feature}-utils.ts

**File Created**: {path}
**Size**: X lines (Y KB)

**Exports**:
- Helper Functions: 5 ✅
- Interfaces: 4 ✅
- Schemas: 4 ✅

**Quality Checks**:
- TypeScript compilation: PASSED ✅
- No `any` types: 0 found ✅
- Explicit return types: All functions ✅
- Import aliases: All use @/ ✅

**Issues**: None
```
```

---

### Template: Provider Module Extraction

```markdown
You are a specialized refactoring agent for {provider} integration.

## Task: Extract {feature}-{provider}.ts (Lines X-Y)

**Source**: `{path}/original.ts`
**Target**: `{path}/{feature}/{provider}.ts`
**Dependencies**: utils.ts (foundation module)

### Procedures to Extract (count):

1. **procedureName1** (lines A-B)
   - Type: query
   - Auth: public
   - Purpose: {description}
   - Returns: `Promise<AsyncResult<Type1, Error>>`

2. **procedureName2** (lines C-D)
   - Type: mutation
   - Auth: protected
   - Purpose: {description}
   - Returns: `Promise<AsyncResult<Type2, Error>>`

### Key Features:

- {Feature 1}: {description}
- {Feature 2}: {description}
- {Feature 3}: {description}

### Instructions:

1. **Read source**: Lines X-Y from original.ts

2. **Create router module**:
   ```typescript
   /**
    * {Provider} Integration Router
    *
    * Handles {provider}-specific metadata operations.
    *
    * Procedures:
    * - procedureName1: {description}
    * - procedureName2: {description}
    *
    * Extracted from: {original}.ts (lines X-Y)
    */

   import { publicProcedure, protectedProcedure } from '../../procedures';
   import { router } from '../../trpc';
   import { z } from 'zod';
   import { logger } from '@/utils/logger';
   import { createSuccessResult, createErrorResult } from '@/utils/async-result';
   import type { AsyncResult } from '@/utils/async-result';

   // Import from foundation utils
   import {
     safeGet,
     safeGetString,
     isRecord,
     handleError,
     type Interface1,
     Schema1,
   } from './utils';

   export const {feature}{Provider}Router = router({
     procedureName1: publicProcedure
       .input(z.object({
         field1: z.string(),
         field2: z.number(),
       }))
       .query(async ({ input }): Promise<AsyncResult<Type1, Error>> => {
         try {
           // Implementation
           logger.info('Executing procedureName1', { input });

           // Use helpers from utils
           const value = safeGetString(data, 'key');

           return createSuccessResult(result);
         } catch (error: unknown) {
           logger.error('Error in procedureName1', { error });
           return createErrorResult(handleError(error));
         }
       }),

     procedureName2: protectedProcedure
       .input(z.object({
         field1: z.string(),
       }))
       .mutation(async ({ input }): Promise<AsyncResult<Type2, Error>> => {
         try {
           // Implementation
           return createSuccessResult(result);
         } catch (error: unknown) {
           return createErrorResult(handleError(error));
         }
       }),
   });
   ```

3. **Service imports**: Use `@/server/services/...` (NOT relative paths)

4. **Dynamic imports**: Use `await import(...)` for external services

5. **File header**: Document purpose and procedures

6. **DO NOT commit**

### Quality Standards:

- ✅ **NO** `any` types
- ✅ Explicit return types: `Promise<AsyncResult<T, Error>>`
- ✅ Use `??` not `||` for nullish coalescing
- ✅ Import from `./utils` for shared code
- ✅ Use `protectedProcedure` for auth-required operations
- ✅ Comprehensive error logging with context
- ✅ Try-catch blocks with AsyncResult pattern
- ✅ Under 500 lines

### Service Imports Expected:

```typescript
// Static imports
import { logger } from '@/utils/logger';

// Dynamic imports (for large services)
const { providerService } = await import('@/server/services/{provider}/service');
const axios = (await import('axios')).default;
```

### Report Format:

```
## Extraction Complete: {feature}-{provider}.ts

**File Created**: {path}
**Size**: X lines (Y KB)

**Procedures Extracted**: Z
1. procedureName1 (query, public)
2. procedureName2 (mutation, protected)

**Dependencies Imported**:
- From utils: safeGet, isRecord, handleError, Interface1
- Services: {list}

**Quality Checks**:
- TypeScript compilation: PASSED ✅
- Line count: X (under 500) ✅
- No `any` types: 0 found ✅
- AsyncResult patterns: All procedures ✅

**Issues**: None
```
```

---

### Template: Main Router Aggregation

```markdown
You are a specialized integration agent for creating main router aggregators.

## Task: Create Main {Feature} Router

**Source**: `{path}/original.ts` (X lines, Y procedures)
**Target**: `{path}/{feature}.ts` (~100 lines, 0 procedures)
**Purpose**: Aggregate all sub-routers into unified router

### Sub-Routers to Aggregate (N routers):

1. **coreRouter** - Core operations (X procedures)
2. **provider1Router** - Provider 1 (Y procedures)
3. **provider2Router** - Provider 2 (Z procedures)
... list all ...

**Total Procedures**: Y procedures across N routers

### Instructions:

1. **BACKUP ORIGINAL FILE**:
   ```bash
   cp {path}/original.ts {path}/original.ts.backup
   ```
   **CRITICAL**: Verify backup created before proceeding!

2. **Create new aggregator**:
   ```typescript
   /**
    * {Feature} Router - Main Aggregator
    *
    * This router aggregates all {feature}-related sub-routers into a single
    * unified router. All procedures from the sub-routers are exposed at the
    * top level for backward compatibility.
    *
    * Architecture:
    * - {feature}/utils.ts - Shared utilities, types, schemas (0 procedures)
    * - {feature}/core.ts - Core operations (X procedures)
    * - {feature}/provider1.ts - Provider 1 integration (Y procedures)
    * - {feature}/provider2.ts - Provider 2 integration (Z procedures)
    * ... list all modules ...
    *
    * Total: Y procedures across N routers
    *
    * Original file: X lines → Refactored: ~100 lines (A% reduction)
    */

   import { router } from '../trpc';

   // Import all sub-routers
   import { {feature}CoreRouter } from './{feature}/core';
   import { {feature}Provider1Router } from './{feature}/provider1';
   import { {feature}Provider2Router } from './{feature}/provider2';
   // ... import all sub-routers

   /**
    * Main {feature} router
    *
    * Merges all sub-routers to expose all Y procedures at the top level.
    * Maintains backward compatibility with existing API consumers.
    *
    * Procedures by Category:
    *
    * Core Operations (X procedures):
    * - procedure1: {description}
    * - procedure2: {description}
    * ... list all ...
    *
    * Provider 1 (Y procedures):
    * - procedure3: {description}
    * - procedure4: {description}
    * ... list all ...
    *
    * Provider 2 (Z procedures):
    * - procedure5: {description}
    * ... list all ...
    */
   export const {feature}Router = router({
     // Merge all sub-routers using tRPC's procedure spreading
     ...{feature}CoreRouter._def.procedures,
     ...{feature}Provider1Router._def.procedures,
     ...{feature}Provider2Router._def.procedures,
     // ... spread all routers
   });
   ```

3. **Verify imports** resolve correctly

4. **Run type-check**: `bun run type-check {path}/{feature}.ts`

5. **Verify procedure count**:
   ```bash
   # Original count
   ORIGINAL=$(grep -c "Procedure" {path}/original.ts)

   # New count (sum of all modules)
   NEW=$(grep -c "Procedure" {path}/{feature}/*.ts | awk '{sum+=$1} END {print sum}')

   # Should match
   if [ "$ORIGINAL" -eq "$NEW" ]; then
     echo "✅ Procedure count matches: $ORIGINAL"
   else
     echo "❌ Procedure count mismatch: Original=$ORIGINAL, New=$NEW"
   fi
   ```

### Quality Standards:

- ✅ Comprehensive file header with full architecture
- ✅ All sub-routers imported with correct paths
- ✅ Procedure spreading for flat API surface
- ✅ Detailed procedure listing by category
- ✅ Procedure descriptions included
- ✅ Backward compatible (all procedures accessible at top level)
- ✅ File under 150 lines
- ✅ TypeScript compilation passes

### Report Format:

```
## Main Router Integration Complete

**Backup Created**: ✅ {path}/original.ts.backup (X lines)
**New File**: {path}/{feature}.ts (Y lines)

**Reduction**: X → Y lines (-Z%, or A% reduction)

**Sub-Routers Imported**: N
1. coreRouter (X procedures)
2. provider1Router (Y procedures)
... list all ...

**Procedure Count Verification**:
- Original: Y procedures
- New (aggregated): Y procedures
- Match: ✅

**TypeScript Compilation**: PASSED ✅

**Quality Checks**:
- File under 150 lines: ✅
- All imports resolve: ✅
- Comprehensive documentation: ✅
- Backward compatible: ✅

**Issues**: None
```
```

---

## Success Metrics

### Quantitative Metrics

**File Size**:
- ✅ All modules under 500 lines
- ✅ Largest module ≤ 490 lines (safety margin)
- ✅ Main aggregator ≤ 150 lines

**Code Quality**:
- ✅ TypeScript errors: 0 in refactored modules
- ✅ ESLint violations: 0
- ✅ `any` types: 0
- ✅ `console.log`: 0

**Architecture**:
- ✅ Single Responsibility: Each module has clear purpose
- ✅ Dependency direction: Foundation → Specific (no circles)
- ✅ Procedure preservation: 100% (no lost functionality)

### Qualitative Metrics

**Maintainability**:
- ✅ Can understand module in < 5 minutes
- ✅ Can modify without touching other modules
- ✅ Clear where to add new procedures

**Testability**:
- ✅ Each module can be tested independently
- ✅ Easy to mock dependencies
- ✅ Clear boundaries for unit tests

**Documentation**:
- ✅ File headers explain purpose
- ✅ Architecture documented in main router
- ✅ Procedure descriptions in main router
- ✅ Refactoring plan document created

---

## Completion Checklist

### Before Committing

```markdown
## Pre-Commit Validation

- [ ] **TypeScript**: 0 errors in all refactored modules
- [ ] **ESLint**: Exit code 0 for all modules
- [ ] **Line Limit**: All files ≤ 500 lines
- [ ] **Procedure Count**: Matches original count
- [ ] **Backup**: Original file backed up
- [ ] **Documentation**: Refactoring plan created
- [ ] **Quality**: No `any`, no `console.log`, all `@/` imports

Run:
```bash
# TypeScript
bun run type-check 2>&1 | grep "src/path/to/modules/"

# ESLint
bun run lint --quiet src/path/to/modules/

# Line counts
wc -l src/path/to/modules/*.ts | awk '$1 > 500'

# Procedure count
grep -c "Procedure" original.ts.backup
grep -c "Procedure" src/path/to/modules/*.ts | awk '{sum+=$1} END {print sum}'
```
```

### Commit Message Template

```
refactor({feature}): Split X-line router into Y focused modules

Refactored monolithic {feature}.ts (X lines) into Y maintainable modules
organized by {provider/functionality}. Reduces complexity by Z% while
maintaining zero breaking changes.

## Architecture Changes

**Before**: Single X-line file with N procedures
**After**: Y modules (max P lines each) + Q-line aggregator

## Module Structure

### Foundation
- utils.ts (A lines) - Shared utilities, types, schemas

### Core Operations
- core.ts (B lines) - Core {feature} operations (N procedures)

### Provider Integration
- provider1.ts (C lines) - Provider 1 integration (M procedures)
- provider2.ts (D lines) - Provider 2 integration (L procedures)

## Quality Standards

All modules follow strict project standards:
- ✅ NO `any` types (use `unknown` + type guards)
- ✅ Explicit return types on all exports
- ✅ AsyncResult pattern for error handling
- ✅ Nullish coalescing (`??`) instead of `||`
- ✅ Import aliases (`@/`) throughout
- ✅ Protected procedures for authenticated mutations
- ✅ Comprehensive JSDoc comments
- ✅ TypeScript strict mode compliance
- ✅ ESLint zero violations

## Benefits

**Maintainability**: Each module is A-P lines (readable, focused)
**Organization**: Logical grouping by {provider/feature}
**Type Safety**: Shared utilities prevent duplication
**Zero Breaking Changes**: Backward compatible API via procedure spreading
**Performance**: Identical runtime behavior
**Testability**: Modules can be tested independently

## Testing

- ✅ TypeScript: 0 errors in refactored modules
- ✅ ESLint: PASSED (exit code 0)
- ✅ All N procedures accessible via {feature}Router
- ✅ Backup created: {feature}.ts.backup

## Files Changed

- Modified: src/path/{feature}.ts (X→Q lines, -Z%)
- Added: src/path/{feature}/*.ts (Y modules, total lines)
- Added: docs/sessions/{feature}-refactoring-plan.md

Resolves complexity issues while maintaining full backward compatibility.
```

---

## Lessons Learned

### Critical Success Factors

1. **Foundation First**: Extract utilities/types before everything else
2. **Parallel Execution**: Launch independent modules simultaneously (7-10 agents)
3. **Dynamic Imports**: Solve circular dependencies without redesign
4. **Incremental Validation**: Check TypeScript after each phase
5. **Line Limit Focus**: Split further if needed (don't settle for 550 lines)

### Common Pitfalls

1. **Skipping Foundation**: Causes duplication across modules
2. **Sequential Execution**: Wastes time when modules are independent
3. **Relative Imports**: Breaks when moving files, use `@/` aliases
4. **Top-level Imports**: Creates circular dependencies, use dynamic
5. **Large Commits**: Split into phases for easier review/rollback

### Time Optimization

**Metadata Router Results**:
- Planning: 30 minutes
- Phase 1 (Foundation): 10 minutes
- Phase 2 (7 modules in parallel): 20 minutes
- Phase 3 (Complex modules): 15 minutes
- Phase 4 (Integration): 10 minutes
- Validation & Fixes: 30 minutes
- Line limit compliance: 20 minutes
- **Total**: ~2.5 hours

**Without Parallel Execution**: ~5-6 hours
**Time Saved**: 50%+

---

## Appendix: Quick Reference

### Command Cheatsheet

```bash
# Find large files
find src -name "*.ts" -exec wc -l {} \; | awk '$1 > 500' | sort -rn

# Count procedures
grep -c "publicProcedure\|protectedProcedure" file.ts

# Check TypeScript errors
bun run type-check 2>&1 | grep "src/path/" | grep "error TS"

# Check ESLint
bun run lint --quiet src/path/

# Find any types
grep -n ": any" file.ts

# Find console.log
grep -n "console\.log" file.ts

# Check imports
grep "^import" file.ts

# Check circular dependencies
madge --circular src/path/

# Verify procedure count
grep -c "Procedure" original.ts
grep -c "Procedure" modules/*.ts | awk '{sum+=$1} END {print sum}'
```

### File Structure Template

```
src/server/trpc/routers/
├── feature.ts                      (main aggregator, ~100 lines)
├── feature.ts.backup               (original backup)
└── feature/
    ├── utils.ts                    (foundation, 150-200 lines)
    ├── core.ts                     (core ops, 400-500 lines)
    ├── provider-a.ts               (provider, 300-400 lines)
    ├── provider-b.ts               (provider, 300-400 lines)
    └── ... (all under 500 lines)
```

### Module Naming Conventions

```
feature-utils.ts         - Foundation utilities
feature-core.ts          - Core operations
feature-{provider}.ts    - Provider integration
feature-{entity}.ts      - Entity-specific operations
feature-{action}.ts      - Action-specific operations
```

---

**End of Document**

*Last Updated: 2025-11-17*
*Success Rate: 100% (Metadata Router)*
*Maintained by: Development Team*
