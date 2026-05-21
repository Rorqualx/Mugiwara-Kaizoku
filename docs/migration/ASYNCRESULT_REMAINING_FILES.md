# Remaining AsyncResult Migration Files

## Summary
**Total Files Originally Identified**: 40 files with custom success patterns
**Phase 1 Completed**: 7 files
**Phase 2 Completed**: 8 files (including 1 consumer component)
**Total Completed**: 15 files
**Remaining**: 25 files (some may have no actual patterns)

## Files By Category

### 1. tRPC Routers (High Priority - 9 files)
These are API endpoints that should return AsyncResult for consistency:
- `src/server/trpc/router.ts`
- ✅ `src/server/trpc/routers/calendar.ts` (COMPLETED - Phase 2)
- ✅ `src/server/trpc/routers/downloads.ts` (COMPLETED - Phase 2)
- ✅ `src/server/trpc/routers/events.ts` (COMPLETED - Phase 2)
- `src/server/trpc/routers/metadata.ts`
- ✅ `src/server/trpc/routers/notifications.ts` (COMPLETED - Phase 2)
- ✅ `src/server/trpc/routers/search.ts` (COMPLETED - Phase 2)
- `src/server/trpc/routers/settings-events.ts`
- `src/server/trpc/routers/settings.ts`
- `src/server/trpc/routers/suwayomi.ts`

### 2. Authentication & Security (High Priority - 2 files)
Core auth functions that should use AsyncResult:
- `src/lib/auth/api-handlers.ts`
- `src/lib/auth/server-auth.ts`

### 3. Service Layer (Medium Priority - 5 files)
Business logic services:
- `src/server/services/fandom/chapterDetailService.ts`
- `src/server/services/sources/sourceProvider.ts`
- `src/server/parsers/error/ErrorHandler.ts`
- `src/server/queue/workers/calendarMaintenanceWorker.ts`
- `src/server/utils/notification.ts`

### 4. Components (Medium Priority - 6 files)
UI components with local result patterns:
- `src/components/addManga/services/chapterFetchingService.ts`
- `src/components/suwayomi/DownloadButton.tsx`
- `src/components/suwayomi/DownloadManager.tsx`
- `src/components/suwayomi/SuwayomiDownloadManager.tsx`
- `src/components/settings/suwayomi/SuwayomiDashboard.tsx`
- `src/components/settings/suwayomi/SuwayomiSourceList.tsx`

### 5. Hooks (Medium Priority - 2 files)
React hooks with custom result handling:
- `src/hooks/useAuth.ts`
- `src/hooks/useMetadata.ts`

### 6. Utilities (Low Priority - 4 files)
Helper functions and utilities:
- `src/utils/api-response.ts`
- `src/utils/notifications/helpers.ts`
- `src/utils/patterns/patternLearningEngine.ts`
- `src/utils/mobile/__tests__/native-bridge.test.ts`

### 7. Test Files (Low Priority - 3 files)
Test files that mock result patterns:
- `src/test/mocks/handlers.ts`
- `src/components/settings/suwayomi/__tests__/SuwayomiDownloadQueue.test.tsx`
- `src/server/parsers/__tests__/integration/UnifiedParserIntegration.test.ts`
- `src/server/services/comicvine/modules/__tests__/phase3-integration.test.ts`

## Migration Strategy

### Phase 1: Critical API Layer (Week 1)
**Files**: 11 files (9 tRPC routers + 2 auth files)
**Impact**: High - These affect all API responses
**Effort**: 8-10 hours

### Phase 2: Service Layer (Week 2)
**Files**: 5 files
**Impact**: Medium - Business logic consistency
**Effort**: 4-5 hours

### Phase 3: Components & Hooks (Week 3)
**Files**: 8 files (6 components + 2 hooks)
**Impact**: Medium - UI consistency
**Effort**: 6-8 hours

### Phase 4: Utilities & Tests (Week 4)
**Files**: 7 files
**Impact**: Low - Supporting code
**Effort**: 3-4 hours

## Total Estimated Effort
- **Development Time**: 21-27 hours
- **Testing Time**: 5-8 hours
- **Total**: 26-35 hours

## Pattern Examples Found

### Current Patterns to Replace:
```typescript
// Pattern 1: Simple success/error
{ success: true, data: result }
{ success: false, error: message }

// Pattern 2: With additional fields
{ success: true, message: "Operation completed" }
{ success: false, message: "Operation failed", code: "ERROR_CODE" }

// Pattern 3: Nested in responses
return {
  success: true,
  result: data,
  metadata: {...}
}
```

### Should Be Replaced With:
```typescript
// Using AsyncResult
return createSuccessResult(data);
return createErrorResult(
  createContextualError(message, code, metadata)
);
```

## Benefits of Complete Migration
1. **Consistency**: Single pattern for all async operations
2. **Type Safety**: Better TypeScript inference
3. **Error Context**: All errors include metadata
4. **Maintainability**: One place to update error handling
5. **Testing**: Easier to mock and test AsyncResult

## Next Steps
1. Start with Phase 1 (Critical API Layer)
2. Update each file systematically
3. Test thoroughly after each phase
4. Update documentation as needed