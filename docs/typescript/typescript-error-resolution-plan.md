# TypeScript Error Resolution Plan

*Status: Active*  
*Author: TypeScript Team*  
*Canonical: Yes*  
*Date: January 28, 2025*

## Overview

Analysis of TypeScript errors in the Mugiwara-Kaizoku codebase reveals **2,253 total errors**. This document provides a categorized breakdown and strategic resolution plan.

---

## Error Summary

### Top Error Categories (by frequency)

| Error Code | Count | Description | Priority |
|------------|-------|-------------|----------|
| TS2339 | 576 | Property does not exist on type | HIGH |
| TS2353 | 244 | Object literal may only specify known properties | HIGH |
| TS2307 | 208 | Cannot find module or type declarations | CRITICAL |
| TS2305 | 206 | Module has no exported member | CRITICAL |
| TS2304 | 203 | Cannot find name | CRITICAL |
| TS2322 | 115 | Type is not assignable | HIGH |
| TS2693 | 100 | Only refers to a type, but being used as value | MEDIUM |
| TS2558 | 76 | Expected N type arguments, but got M | MEDIUM |
| TS2345 | 63 | Argument type not assignable | HIGH |
| TS2741 | 59 | Property is missing in type | HIGH |

---

## Root Cause Analysis

### 1. **Missing Type Exports (Critical - 460 errors)**
- **TS2305**: Missing exports from canonical types
- **TS2307**: Missing modules/files
- **Primary Issue**: Type system reorganization incomplete

**Affected Areas:**
- `/types/canonical/` - Missing exports like `MetadataDetails`, `ChapterEntity`, `DownloadMethod`
- Missing utility modules: `compatibility-map`, `unified-rate-limiter`
- Missing UI component exports from `./forms`, `./navigation`, `./data-display`

### 2. **Property Mismatches (576 errors)**
- **TS2339**: Properties don't exist on types
- **Primary Issues**:
  - Config types missing properties (`apiKeySources`, `apiKey`, `token`)
  - AsyncResult pattern usage inconsistent
  - Test types not matching implementation

### 3. **Type Assignment Issues (237 errors)**
- **TS2322 + TS2345**: Type assignment mismatches
- **Primary Issues**:
  - Date vs string conversions
  - Missing required properties in objects
  - AsyncResult generic type mismatches

### 4. **Import Path Problems (208 errors)**
- **TS2307**: Module resolution failures
- **Primary Issues**:
  - Files moved/deleted during consolidation
  - Relative import paths broken
  - Missing type declaration files

---

## Resolution Strategy

### Phase 1: Critical Foundation Fixes (Week 1)

#### 1.1 Fix Canonical Type Exports
```typescript
// src/types/canonical/manga.types.ts
export type MetadataDetails = {
  cover: string;
  status: MangaStatus;
  // ... other properties
};

export interface ChapterEntity {
  id: string;
  number: number;
  title?: string;
  // ... other properties
}
```

#### 1.2 Create Missing Utility Modules
- Create `/utils/compatibility-map.ts`
- Create `/utils/unified-rate-limiter.ts`
- Restore missing UI component exports

#### 1.3 Fix Config Type Definitions
```typescript
// Update config types to include missing properties
interface SuwayomiConfig {
  apiKeySources?: string[];
  // ... existing properties
}
```

### Phase 2: Type Assignment Corrections (Week 2)

#### 2.1 Date/String Conversions
- Standardize date handling across adapters
- Use consistent conversion utilities

#### 2.2 AsyncResult Pattern Fixes
- Ensure proper generic types in createSuccessResult
- Add missing properties to MetadataDetails

#### 2.3 Missing Properties
- Add `enabled` property to NotificationProviderConfig
- Add `type` property to search results

### Phase 3: Import Path Resolution (Week 3)

#### 3.1 Module Resolution
- Update tsconfig paths
- Fix relative imports
- Create missing type declaration files

#### 3.2 Test File Updates
- Align test types with implementations
- Update mock data structures

---

## Implementation Priorities

### Immediate Actions (Day 1-2)
1. **Export missing types from canonical**
   - Add MetadataDetails, ChapterEntity, DownloadMethod
   - Export SearchResult, MangaSearchResultBase
   
2. **Create critical missing files**
   - `/utils/compatibility-map.ts`
   - `/utils/unified-rate-limiter.ts`
   - `/utils/admin-debug.ts`

3. **Fix config interfaces**
   - Add missing properties to all config types
   - Ensure notification configs have `enabled` field

### Short-term (Week 1)
1. Fix AsyncResult usage in adapters
2. Standardize date handling
3. Update test files with correct types
4. Fix UI component exports

### Medium-term (Week 2-3)
1. Complete import path corrections
2. Resolve all type assignment issues
3. Fix namespace/value confusion errors
4. Update documentation with type changes

---

## File-Specific Fixes

### High-Impact Files (Most Errors)
1. `/api/metadataProviders/adapters/*.ts` - 115+ errors each
2. `/components/addManga/steps/confirmationStep.tsx` - 200+ errors
3. `/server/services/search/providers/*.ts` - 50+ errors each
4. `/utils/notifications/migration.ts` - 40+ errors

### Quick Win Files (Easy Fixes)
1. Config type additions - 100+ errors resolved
2. Missing exports - 200+ errors resolved
3. Date/string conversions - 50+ errors resolved

---

## Success Metrics

### Target Milestones
- **Day 1**: Reduce errors by 500 (critical exports)
- **Week 1**: Reduce errors by 1000 (50% reduction)
- **Week 2**: Reduce errors by 1500 (75% reduction)
- **Week 3**: Zero TypeScript errors

### Validation Steps
1. Run `npm run type-check` after each phase
2. Ensure no runtime errors introduced
3. Run test suite to verify functionality
4. Document any breaking changes

---

## Risk Mitigation

### Potential Risks
1. **Breaking Changes**: Some fixes may require API changes
2. **Test Failures**: Type fixes might reveal test issues
3. **Runtime Errors**: Stricter types might expose runtime issues

### Mitigation Strategies
1. Create feature branches for each phase
2. Run comprehensive tests after each fix
3. Document all breaking changes
4. Maintain backward compatibility where possible

---

## Tools & Scripts

### Helpful Commands
```bash
# Count errors by type
npm run type-check 2>&1 | grep "error TS" | sed 's/.*error TS\([0-9]*\).*/\1/' | sort | uniq -c | sort -rn

# Find specific error patterns
npm run type-check 2>&1 | grep "TS2339" | grep "apiKey"

# Check specific file
npx tsc --noEmit --skipLibCheck src/specific/file.ts

# Generate missing type stubs
npx tsc --declaration --emitDeclarationOnly
```

---

## Next Steps

1. **Review this plan** with the team
2. **Create feature branch** for type fixes
3. **Start with Phase 1** critical fixes
4. **Track progress** using TODO list
5. **Update this document** with results

---

## References

- [TypeScript Patterns Guide](./typescript-patterns-guide.md)
- [Type System Architecture](../type-system-architecture-standardization.md)
- [AsyncResult Standardization](../async-result-standardization.md)
- [Error Handling Guide](../error-handling-standardized.md)

---

*Last Updated: January 28, 2025*