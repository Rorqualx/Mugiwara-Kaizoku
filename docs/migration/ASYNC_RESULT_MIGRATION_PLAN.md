# AsyncResult Migration Plan - Eliminate Legacy Code

## Objective
Eliminate ALL legacy throwing methods and backward compatibility code, moving to AsyncResult-only pattern throughout the codebase.

## Current State
- **83 files** with dual method implementations
- Methods like `search()` (throws) + `searchAsync()` (AsyncResult)
- Unnecessary code duplication and maintenance burden
- Inconsistent error handling patterns

## Migration Strategy

### Phase 1: Update Core Interface (IMMEDIATE)
1. **Modify IntegrationAdapter interface**
   - Remove ALL throwing method signatures
   - Rename `searchAsync()` → `search()` 
   - Rename `getMangaByIdAsync()` → `getMangaById()`
   - Make AsyncResult the ONLY return pattern

### Phase 2: Update Implementations (TODAY)
1. **baseKapowarrAdapter.ts**
   - Remove `unwrapAsyncResult()` utility
   - Remove all throwing method versions
   - Rename internal `_search()` → `search()`
   - Remove duplicate interface compliance methods

2. **suwayomiAdapter.ts**
   - Remove throwing method implementations
   - Keep only AsyncResult versions
   - Update method signatures

3. **metadataAdapterWrapper.ts**
   - Remove try/catch wrappers
   - Remove dual method implementations
   - Use AsyncResult throughout

### Phase 3: Update Callers (CRITICAL)
1. **Find all callers of legacy methods**
   ```typescript
   // Before
   const results = await adapter.search(query);
   
   // After
   const result = await adapter.search(query);
   if (!isSuccess(result)) {
     // Handle error
     return;
   }
   const results = result.data;
   ```

2. **Update TRPC routers**
   - Add isSuccess checks
   - Handle AsyncResult properly

3. **Update React components/hooks**
   - Handle AsyncResult in UI code
   - Update error handling

### Phase 4: Remove Deprecated Code
1. Remove all `@deprecated` methods
2. Remove backward compatibility utilities
3. Remove legacy type adapters

## Files to Modify

### High Priority (Core Interfaces)
1. `/src/utils/integration-adapter.ts` - Update interface
2. `/src/server/adapters/metadata/baseKapowarrAdapter.ts` - Remove dual methods
3. `/src/server/adapters/metadata/suwayomiAdapter.ts` - Remove dual methods
4. `/src/server/services/metadata/metadataAdapterWrapper.ts` - Remove wrappers

### Medium Priority (Implementations)
5. All files in `/src/server/adapters/metadata/`
6. All files in `/src/server/services/`
7. TRPC routers that call these methods

### Low Priority (Cleanup)
8. Remove deprecated utilities
9. Update documentation
10. Remove legacy tests

## Implementation Order

1. **Create new interface** (don't modify existing yet)
2. **Update one adapter** as proof of concept
3. **Test thoroughly**
4. **Update remaining adapters**
5. **Update all callers**
6. **Remove old interface**
7. **Clean up deprecated code**

## Breaking Changes

This migration WILL introduce breaking changes:
- All method signatures change
- All callers must be updated
- Error handling patterns change

## Benefits

1. **Reduced code** - Eliminate ~50% of adapter code
2. **Consistent errors** - One error handling pattern
3. **Type safety** - AsyncResult provides better type checking
4. **Maintainability** - Single implementation path
5. **Performance** - Less wrapping/unwrapping overhead

## Timeline

- **Day 1**: Update interfaces and core adapters
- **Day 2**: Update all callers
- **Day 3**: Testing and bug fixes
- **Day 4**: Remove deprecated code
- **Day 5**: Documentation and cleanup

## Success Metrics

- 0 throwing methods remain
- 0 duplicate method implementations
- 100% AsyncResult pattern adoption
- ~2000 lines of code removed
- 0 TypeScript errors