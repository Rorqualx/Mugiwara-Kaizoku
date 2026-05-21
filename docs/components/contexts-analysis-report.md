# Context Folder Analysis Report

*Status: Active*  
*Author: Code Analysis*  
*Date: 2025-08-28*  
*Canonical: Yes*

## Overview

Analysis of the `/src/contexts` folder to identify duplication, legacy code, and consolidation opportunities.

## Current Structure

### Active Context Files (7 files, 1242 lines total)
1. **DomainContext.tsx** (34 lines) - Provides domain-specific utilities
2. **UserContext.tsx** (108 lines) - User authentication and session management
3. **NavbarContext.tsx** (101 lines) - Navigation state management
4. **IntegrationStatusContext.tsx** (181 lines) - Integration status tracking
5. **ProwlarrContext.tsx** (326 lines) - Prowlarr integration management
6. **search/MainSearchContext.tsx** (232 lines) - Main search functionality
7. **search/ModalSearchContext.tsx** (260 lines) - Modal-specific search

### Legacy Backup Files (4 files - TO BE REMOVED)
- DomainContext.tsx.pre-phase3
- UserContext.tsx.pre-phase3  
- search/MainSearchContext.tsx.pre-phase3
- search/ModalSearchContext.tsx.pre-phase3

## Key Findings

### 1. Search Context Duplication

**MainSearchContext.tsx** and **ModalSearchContext.tsx** are nearly identical:
- Same interface structure (`MainSearchContextType` vs `ModalSearchContextType`)
- Same state management patterns
- Same AsyncResult implementation
- Same tRPC query patterns
- Only difference: ModalSearchContext includes timeout handling

**Recommendation**: Consolidate into a single `SearchContext` with an optional `isModal` prop or configuration.

### 2. Legacy Backup Files

Four `.pre-phase3` backup files exist that:
- Are no longer needed (main files have been updated)
- Add unnecessary clutter
- May cause confusion during development

**Recommendation**: Delete all `.pre-phase3` files immediately.

### 3. Context Organization

Current contexts serve distinct purposes:
- **Authentication/User**: UserContext
- **Navigation**: NavbarContext  
- **Integration Management**: IntegrationStatusContext, ProwlarrContext
- **Search**: MainSearchContext, ModalSearchContext
- **Utilities**: DomainContext

**Recommendation**: Group related contexts in subdirectories:
```
/contexts
  /auth
    - UserContext.tsx
  /navigation  
    - NavbarContext.tsx
  /integrations
    - IntegrationStatusContext.tsx
    - ProwlarrContext.tsx
  /search
    - SearchContext.tsx (consolidated)
  /utils
    - DomainContext.tsx
```

### 4. Code Quality Issues

#### ProwlarrContext.tsx
- Largest file (326 lines) - could benefit from extraction of logic
- Contains mock implementations that should be in test utilities
- Complex client management logic mixed with React context

#### IntegrationStatusContext.tsx
- Good separation of concerns
- Well-documented with JSDoc
- Could benefit from extracting type guard to utilities

## Immediate Actions

### Priority 1: Remove Legacy Files
```bash
rm /src/contexts/*.pre-phase3
rm /src/contexts/search/*.pre-phase3
```

### Priority 2: Consolidate Search Contexts

Create a unified SearchContext that can handle both main and modal search:

```typescript
interface SearchContextConfig {
  isModal?: boolean;
  enableTimeout?: boolean;
  timeoutDuration?: number;
}

export function SearchProvider({ 
  children, 
  config = {} 
}: { 
  children: ReactNode; 
  config?: SearchContextConfig 
}) {
  // Unified implementation
}
```

### Priority 3: Extract Complex Logic

For ProwlarrContext:
- Move client creation to `/src/services/prowlarr/`
- Extract mock implementations to `/src/test/mocks/`
- Keep context focused on state management only

## Benefits of Consolidation

1. **Reduced Code Duplication**: ~200 lines saved by consolidating search contexts
2. **Improved Maintainability**: Single source of truth for search logic
3. **Cleaner Structure**: Organized by domain rather than scattered
4. **Better Testing**: Easier to test consolidated components
5. **Reduced Bundle Size**: Less duplicate code in production

## Migration Path

1. **Phase 1**: Remove backup files (immediate)
2. **Phase 2**: Consolidate search contexts (1-2 hours)
3. **Phase 3**: Reorganize directory structure (30 minutes)
4. **Phase 4**: Extract complex logic from ProwlarrContext (1 hour)

## Impact Assessment

- **Risk Level**: Low
- **Breaking Changes**: None (maintain existing exports)
- **Testing Required**: Update imports in affected components
- **Components Affected**: ~20 components use these contexts

## Conclusion

The contexts folder contains unnecessary duplication and legacy code that should be cleaned up. The primary opportunity is consolidating the two search contexts, which would eliminate ~40% of duplicated code. Removing backup files and reorganizing the structure will improve developer experience and maintainability.

---

*Next Steps*: Proceed with Priority 1 (remove legacy files) immediately, then implement search context consolidation.