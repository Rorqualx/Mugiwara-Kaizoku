# TypeScript Error Manual Review

*Generated: September 20, 2025*

## Error Summary
- **Total Error Lines**: 153
- **Unique Files with Errors**: 14
- **Primary Error Pattern**: Consumer components attempting to access `.success` and `.value` properties on AsyncResult types

## Error Categories

### Category 1: Consumer Component Errors (Most Common)
These components are trying to access `.success` and `.value` properties that don't exist on AsyncResult types.

#### Files Affected:
1. **`/components/manga/BulkDownloadModal.tsx`** (4 errors)
   - Lines: 132, 178
   - Pattern: `result.success` and `result.value`

2. **`/components/manga/DownloadOptionsModal.tsx`** (10 errors)
   - Lines: 80, 86, 92, 127
   - Pattern: `result.success` and `result.value`

3. **`/components/manga/PackSearchModal.tsx`** (12 errors)
   - Lines: 151, 157, 163, 169, 211, 215
   - Pattern: `result.success` and `result.value`

4. **`/components/settings/calendar/CalendarProviderSettings.tsx`** (6 errors)
   - Lines: 66, 128
   - Pattern: `result.success` and `result.value`

5. **`/components/settings/DefaultMetadataProvider.tsx`** (2 errors)
   - Line: 70
   - Pattern: `result.success` and `result.value`

6. **`/components/settings/integration.tsx`** (3 errors)
   - Lines: 120, 122
   - Pattern: `result.success` and `result.value`

7. **`/components/settings/MetadataProviderCard.tsx`** (2 errors)
   - Line: 54
   - Pattern: `result.success` and `result.value`

8. **`/components/settings/MetadataProvidersGrid.tsx`** (2 errors)
   - Line: 51
   - Pattern: `result.success` and `result.value`

9. **`/components/settings/notification.tsx`** (12 errors)
   - Lines: 124-130
   - Pattern: `result.success` and `result.value`

10. **`/components/settings/WikipediaSettings.tsx`** (2 errors)
    - Line: 22
    - Pattern: `result.success` and `result.value`

### Category 2: Hook Errors
These hooks have logic issues with AsyncResult handling.

11. **`/hooks/useConfigService.ts`** (3 errors)
    - Lines: 101, 102, 105
    - Issue: Still checking `result.success` instead of using `isSuccess(result)`

12. **`/hooks/useConfigTRPC.ts`** (4 errors)
    - Lines: 84, 86, 87
    - Similar pattern issues

13. **`/hooks/metadata/useMetadataInitialization.ts`** (2 errors)
    - Line: 36
    - Pattern: `result.success` and `result.value`

### Category 3: Page Component Errors

14. **`/pages/settings/file-organization.tsx`** (3 errors)
    - Line: 78-79

15. **`/pages/settings/integrations/kavita.tsx`** (2 errors)
    - Lines: 146-147

16. **`/pages/settings/integrations/komga.tsx`** (2 errors)
    - Lines: 119-120

17. **`/pages/settings/integrations/prowlarr.tsx`** (1 error)
    - Line: 36

### Category 4: Already Migrated Files with Remaining Issues

18. **`/components/settings/suwayomi/SuwayomiDownloadQueue.tsx`** (2 errors)
    - Lines: 134, 156
    - Already migrated but may have missed spots

19. **`/server/trpc/routers/settings.ts`** (3 errors)
    - Lines: 437, 492, 605
    - Already migrated but has some remaining issues

## Migration Pattern Required

All these errors follow the same pattern and need the same fix:

### Before (Old Pattern):
```typescript
if (result.success) {
  const data = result.value;
  // ...
}
```

### After (AsyncResult Pattern):
```typescript
import { isSuccess, isError } from '@/utils/async-result';

if (isSuccess(result)) {
  const data = result.data;
  // ...
}
```

Or for error checking:
```typescript
if (isError(result)) {
  console.error(result.error);
}
```

## Fix Priority

### High Priority (User-Facing Components):
1. `/components/manga/*` - 26 errors
2. `/components/settings/*` - 25 errors
3. `/hooks/*` - 9 errors

### Medium Priority (Settings Pages):
4. `/pages/settings/*` - 8 errors

### Low Priority (Already Partially Migrated):
5. Files with only 1-3 errors remaining

## Common Error Patterns

### Pattern 1: Direct Property Access
```typescript
Property 'success' does not exist on type '{ status: "idle"; } | { status: "loading"; } | { status: "success"; data: unknown; } | { status: "error"; error: ContextualError; }'
```
**Fix**: Use `isSuccess()`, `isError()`, `isLoading()`, `isIdle()` helpers

### Pattern 2: Value vs Data
```typescript
Property 'value' does not exist...
```
**Fix**: AsyncResult uses `data` not `value` when successful

### Pattern 3: Union Type Confusion
The AsyncResult type is a discriminated union with these states:
- `{ status: "idle" }`
- `{ status: "loading" }`
- `{ status: "success"; data: T }`
- `{ status: "error"; error: ContextualError }`

## Quick Fix Script

For bulk fixing, you could use this pattern:
```bash
# Replace .success checks
sed -i '' 's/if (result\.success)/if (isSuccess(result))/g' <file>
sed -i '' 's/!result\.success/!isSuccess(result)/g' <file>
sed -i '' 's/result\.success ?/isSuccess(result) ?/g' <file>

# Replace .value with .data
sed -i '' 's/result\.value/result.data/g' <file>

# Add imports if not present
sed -i '' '1s/^/import { isSuccess, isError } from "@\/utils\/async-result";\n/' <file>
```

## Next Steps

1. **Batch Fix Components**: Fix all `/components/manga/*` files together
2. **Fix Hooks**: Update the 3 hooks with errors
3. **Settings Components**: Fix all settings-related components
4. **Pages**: Update the settings pages
5. **Test**: Run build and verify all TypeScript errors are resolved

## Notes
- All tRPC routers have been successfully migrated to AsyncResult
- The API layer is complete and consistent
- These are all consumer-side errors where components need to use AsyncResult helpers
- Total estimated fix time: 2-3 hours for complete resolution