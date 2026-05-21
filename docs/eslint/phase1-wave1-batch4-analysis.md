# Phase 1 Wave 1 Batch 4 Analysis

**Generated**: 2025-11-08
**Status**: Ready for Implementation
**Analyst**: Claude Code
**Scope**: Low-risk utility files - testing, PWA, performance, type guards

---

## Executive Summary

### Batch Statistics
- **Total Violations**: 25
- **Files**: 5
- **Risk Level**: Low
- **Estimated Time**: 3-4 hours
- **Confidence**: High (95%)
- **Dependencies**: None (standalone utilities)

### Comparison with Previous Batches

| Batch | Violations | Files | Risk | Focus Area |
|-------|-----------|-------|------|------------|
| Batch 1 | 24 | 5 | Low | Logger, type guards, error handling |
| Batch 2 | 25 | 10 | Low | Metadata utils, DB errors, services |
| Batch 3 | 23 | 1 | Low | Calendar export utilities |
| **Batch 4** | **25** | **5** | **Low** | **Testing, PWA, performance, type guards** |

**Cumulative Progress**: 97/150 violations (64.7% of Wave 1)

### Selection Criteria

This batch focuses on:
1. **Testing utilities** - Adapter compliance verification (11 violations)
2. **Browser API compatibility** - PWA manager (5 violations)
3. **Performance monitoring** - Mobile performance utilities (4 violations)
4. **Type guards** - Metadata validation (3 violations)
5. **Rate limiting** - Error detection (2 violations)

All files are low-risk utilities with clear type patterns and no complex dependencies.

---

## Violations by File

### File 1: `/src/utils/testing/adapter-compliance.ts`

**Violations**: 11
**Pattern**: `(adapter as any)[method]` for dynamic method access
**Risk**: Low (test utilities only)
**Lines**: 118, 126, 134, 137, 148, 149, 214, 219, 222, 225, 228

#### Current Code

```typescript
// Lines 118-121
for (const method of methodsToCheck) {
    if (typeof (adapter as any)[method] !== 'function') {
        issues.push(`Missing or non-function method: ${method}`);
    }
}

// Lines 126-129
for (const method of REQUIRED_ASYNC_RESULT_METHODS) {
    if (!skipMethods.includes(method) && typeof (adapter as any)[method] !== 'function') {
        issues.push(`Missing required AsyncResult method: ${method}`);
    }
}

// Lines 134-139
const baseMethodsToCheck = ['search', 'getMangaById', 'getMangaByTitle', 'getStatus'].
    filter((method) => !skipMethods.includes(method)).
    filter((method) => typeof (adapter as any)[method] === 'function');

for (const method of baseMethodsToCheck) {
    const asyncMethod = `${method}Async`;
    if (!skipMethods.includes(asyncMethod) && typeof (adapter as any)[asyncMethod] !== 'function') {
        issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented base method: ${method}`);
    }
}

// Lines 148-151
if (typeof (adapter as any)[baseMethod] === 'function' &&
    typeof (adapter as any)[asyncMethod] !== 'function') {
    issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented optional method: ${baseMethod}`);
}

// Lines 214-228
if (typeof (adapter as any)[method] === 'function') {
    try {
        let result;
        if (method === 'searchAsync') {
            result = await (adapter as any)[method](searchQuery);
        }
        else if (method === 'getMangaByIdAsync' || method === 'getMangaByTitleAsync') {
            result = await (adapter as any)[method](sampleId);
        }
        else if (method === 'getChaptersAsync') {
            result = await (adapter as any)[method](sampleId);
        }
        else {
            result = await (adapter as any)[method]();
        }
        // ...
    }
}
```

#### Proposed Fix

```typescript
// Create typed helper for dynamic method access
type AdapterMethod = keyof IntegrationAdapter<BaseIntegrationConfig>;

function hasMethod<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    method: string
): method is AdapterMethod {
    return method in adapter && typeof adapter[method as AdapterMethod] === 'function';
}

function getMethod<T extends BaseIntegrationConfig>(
    adapter: IntegrationAdapter<T>,
    method: string
): ((...args: unknown[]) => unknown) | undefined {
    if (!hasMethod(adapter, method)) {
        return undefined;
    }
    const fn = adapter[method as AdapterMethod];
    return typeof fn === 'function' ? fn as (...args: unknown[]) => unknown : undefined;
}

// Lines 118-121 - Fixed
for (const method of methodsToCheck) {
    if (!hasMethod(adapter, method)) {
        issues.push(`Missing or non-function method: ${method}`);
    }
}

// Lines 126-129 - Fixed
for (const method of REQUIRED_ASYNC_RESULT_METHODS) {
    if (!skipMethods.includes(method) && !hasMethod(adapter, method)) {
        issues.push(`Missing required AsyncResult method: ${method}`);
    }
}

// Lines 134-139 - Fixed
const baseMethodsToCheck = ['search', 'getMangaById', 'getMangaByTitle', 'getStatus']
    .filter((method) => !skipMethods.includes(method))
    .filter((method) => hasMethod(adapter, method));

for (const method of baseMethodsToCheck) {
    const asyncMethod = `${method}Async`;
    if (!skipMethods.includes(asyncMethod) && !hasMethod(adapter, asyncMethod)) {
        issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented base method: ${method}`);
    }
}

// Lines 148-151 - Fixed
if (hasMethod(adapter, baseMethod) && !hasMethod(adapter, asyncMethod)) {
    issues.push(`Missing corresponding AsyncResult method: ${asyncMethod} for implemented optional method: ${baseMethod}`);
}

// Lines 214-228 - Fixed
const methodFn = getMethod(adapter, method);
if (methodFn) {
    try {
        let result: unknown;
        if (method === 'searchAsync') {
            result = await methodFn(searchQuery);
        }
        else if (method === 'getMangaByIdAsync' || method === 'getMangaByTitleAsync') {
            result = await methodFn(sampleId);
        }
        else if (method === 'getChaptersAsync') {
            result = await methodFn(sampleId);
        }
        else {
            result = await methodFn();
        }
        // ...
    }
}
```

**Cascade Impact**: 0 violations (test-only code)

---

### File 2: `/src/utils/mobile/pwa-manager.ts`

**Violations**: 5
**Pattern**: `(window.navigator as any).standalone`, `(navigator as any).setAppBadge`, etc.
**Risk**: Low (browser API compatibility)
**Lines**: 75, 181, 199, 202, 219

#### Current Code

```typescript
// Line 75
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

// Line 181
if (error instanceof Error && (error instanceof Error ? error["name"] : String(error)) === 'AbortError') {
    return createErrorResult(new Error('Share cancelled'));
}

// Lines 199-202
if ('setAppBadge' in navigator) {
    await (navigator as any).setAppBadge(count);
}
else if ('setExperimentalAppBadge' in navigator) {
    await (navigator as any).setExperimentalAppBadge(count);
}

// Lines 219-221
if ('clearAppBadge' in navigator) {
    await (navigator as any).clearAppBadge();
}
else if ('clearExperimentalAppBadge' in navigator) {
    await (navigator as any).clearExperimentalAppBadge();
}
```

#### Proposed Fix

```typescript
// Create type definitions for experimental PWA APIs
interface ExtendedNavigator extends Navigator {
    standalone?: boolean;
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
    setExperimentalAppBadge?: (count?: number) => Promise<void>;
    clearExperimentalAppBadge?: () => Promise<void>;
}

// Line 75 - Fixed
const extendedNavigator = window.navigator as ExtendedNavigator;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    extendedNavigator.standalone === true;

// Line 181 - Fixed (already correct pattern, just need type guard)
function isAbortError(error: unknown): error is Error & { name: 'AbortError' } {
    return error instanceof Error && error.name === 'AbortError';
}

// Usage
if (isAbortError(error)) {
    return createErrorResult(new Error('Share cancelled'));
}

// Lines 199-202 - Fixed
const extendedNav = navigator as ExtendedNavigator;
if (extendedNav.setAppBadge) {
    await extendedNav.setAppBadge(count);
}
else if (extendedNav.setExperimentalAppBadge) {
    await extendedNav.setExperimentalAppBadge(count);
}

// Lines 219-221 - Fixed
if (extendedNav.clearAppBadge) {
    await extendedNav.clearAppBadge();
}
else if (extendedNav.clearExperimentalAppBadge) {
    await extendedNav.clearExperimentalAppBadge();
}
```

**Additional File**: Create `/src/types/browser-apis/pwa-apis.d.ts`:

```typescript
/**
 * Extended PWA API Types
 *
 * Type definitions for experimental PWA APIs not yet in standard TypeScript libs.
 */

interface ExtendedNavigator extends Navigator {
    /** iOS-specific property to detect standalone mode */
    standalone?: boolean;

    /** Badge API - Standard */
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;

    /** Badge API - Experimental */
    setExperimentalAppBadge?: (count?: number) => Promise<void>;
    clearExperimentalAppBadge?: () => Promise<void>;
}

declare global {
    interface Window {
        navigator: ExtendedNavigator;
    }
}

export {};
```

**Cascade Impact**: 0 violations (browser APIs handled safely)

---

### File 3: `/src/utils/mobile/performance.ts`

**Violations**: 4
**Pattern**: `(navigator as any).connection`, `(navigator as any).deviceMemory`, `(entry as any).hadRecentInput`
**Risk**: Low (browser API compatibility)
**Lines**: 78, 103, 176, 177

#### Current Code

```typescript
// Line 78-84
export function getNetworkInfo(): NetworkInfo {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
        return {};
    }
    const connection = (navigator as any).connection;
    return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
    };
}

// Line 103
deviceMemory: (navigator as any).deviceMemory,

// Lines 176-177
for (const entry of list.getEntries()) {
    if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
    }
}
```

#### Proposed Fix

```typescript
// Create type definitions for Network Information API
interface NetworkInformation {
    effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    deviceMemory?: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
    hadRecentInput?: boolean;
    value?: number;
}

// Line 78-84 - Fixed
export function getNetworkInfo(): NetworkInfo {
    if (typeof navigator === 'undefined') {
        return {};
    }

    const extendedNavigator = navigator as NavigatorWithConnection;
    if (!extendedNavigator.connection) {
        return {};
    }

    const connection = extendedNavigator.connection;
    return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
    };
}

// Line 103 - Fixed
const extendedNavigator = navigator as NavigatorWithConnection;
// ... in getDeviceCapabilities return object:
deviceMemory: extendedNavigator.deviceMemory,

// Lines 176-177 - Fixed
for (const entry of list.getEntries()) {
    const layoutShift = entry as LayoutShiftEntry;
    if (!layoutShift.hadRecentInput) {
        clsValue += layoutShift.value ?? 0;
    }
}
```

**Additional File**: Create `/src/types/browser-apis/network-information.d.ts`:

```typescript
/**
 * Network Information API Types
 *
 * Type definitions for the Network Information API.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

interface NetworkInformation {
    /** Effective connection type */
    effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
    /** Downlink speed in Mbps */
    downlink?: number;
    /** Round trip time in milliseconds */
    rtt?: number;
    /** Data saver mode enabled */
    saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
    /** Network connection information (experimental) */
    connection?: NetworkInformation;
    /** Device memory in GB (experimental) */
    deviceMemory?: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
    /** Whether the shift had recent user input */
    hadRecentInput?: boolean;
    /** Layout shift score */
    value?: number;
}

declare global {
    interface Navigator extends NavigatorWithConnection {}
}

export {};
```

**Cascade Impact**: 0 violations (browser APIs handled safely)

---

### File 4: `/src/utils/validation/metadata-typeguards.ts`

**Violations**: 3
**Pattern**: `(obj as any).metadata` for property access
**Risk**: Low (type guard implementations)
**Lines**: 38, 39, 40

#### Current Code

```typescript
// Lines 38-40
export function hasMetadataField<T extends string>(
  obj: unknown,
  field: T
): obj is {
  metadata?: Record<T, unknown>
} {
  return hasMetadata(obj) &&
    typeof (obj as any).metadata === 'object' &&
    (obj as any).metadata !== null &&
    field in ((obj as any).metadata);
}
```

#### Proposed Fix

```typescript
// Create type-safe helper
type ObjectWithMetadata = { metadata?: Record<string, unknown> };

function isObjectWithMetadata(obj: unknown): obj is ObjectWithMetadata {
    return obj !== null &&
           typeof obj === 'object' &&
           'metadata' in obj;
}

// Lines 38-40 - Fixed
export function hasMetadataField<T extends string>(
  obj: unknown,
  field: T
): obj is {
  metadata?: Record<T, unknown>
} {
  if (!hasMetadata(obj) || !isObjectWithMetadata(obj)) {
    return false;
  }

  const metadata = obj.metadata;
  return typeof metadata === 'object' &&
         metadata !== null &&
         field in metadata;
}
```

**Cascade Impact**: 0 violations (type guards are self-contained)

---

### File 5: `/src/utils/rate-limiter.ts`

**Violations**: 2
**Pattern**: `(error as any).message`, `(error as any).response?.status` for error inspection
**Risk**: Low (error detection utility)
**Lines**: 268, 269

#### Current Code

```typescript
// Lines 268-274
private isRateLimitError(error: unknown): boolean {
    if (!error)
    return false;
    const message = (error as any).message?.toLowerCase() ?? '';
    const statusCode = (error as any).response?.status ?? (error as any).statusCode;
    return statusCode === 429 || // Too Many Requests
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('throttle');
}
```

#### Proposed Fix

```typescript
// Create type guards for error types
interface ErrorLike {
    message?: string;
}

interface HTTPError extends ErrorLike {
    response?: {
        status?: number;
    };
    statusCode?: number;
}

function isErrorLike(error: unknown): error is ErrorLike {
    return error !== null &&
           typeof error === 'object' &&
           'message' in error;
}

function isHTTPError(error: unknown): error is HTTPError {
    return isErrorLike(error) &&
           ('response' in error || 'statusCode' in error);
}

// Lines 268-274 - Fixed
private isRateLimitError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    const message = isErrorLike(error)
        ? error.message?.toLowerCase() ?? ''
        : '';

    let statusCode: number | undefined;
    if (isHTTPError(error)) {
        statusCode = error.response?.status ?? error.statusCode;
    }

    return statusCode === 429 || // Too Many Requests
           message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('throttle');
}
```

**Cascade Impact**: 0 violations (error handling is isolated)

---

## Implementation Order

### Priority 1: Type Definitions (Foundation)
1. **Create browser API type definitions** (15 minutes)
   - `/src/types/browser-apis/pwa-apis.d.ts`
   - `/src/types/browser-apis/network-information.d.ts`

### Priority 2: Simple Utilities (Low Risk)
2. **Fix rate-limiter.ts** (20 minutes)
   - Add error type guards
   - Update isRateLimitError method

3. **Fix metadata-typeguards.ts** (15 minutes)
   - Add type-safe helper
   - Update hasMetadataField function

### Priority 3: Browser APIs (Clear Patterns)
4. **Fix pwa-manager.ts** (30 minutes)
   - Apply ExtendedNavigator types
   - Update badge API calls
   - Add abort error type guard

5. **Fix performance.ts** (30 minutes)
   - Apply NavigatorWithConnection types
   - Update layout shift handling
   - Fix network info retrieval

### Priority 4: Testing Utilities (Most Complex)
6. **Fix adapter-compliance.ts** (60 minutes)
   - Create hasMethod and getMethod helpers
   - Update all dynamic method access
   - Test with existing adapter implementations

**Total Estimated Time**: 2.75 hours (165 minutes)

---

## Expected Cascade Impact

### Direct Fixes
- **25 no-explicit-any violations** → 0

### Related Improvements
- **Browser API type safety**: All experimental PWA/Network APIs properly typed
- **Error handling**: Type-safe error inspection patterns
- **Test utilities**: Type-safe dynamic method access
- **Type guards**: Cleaner metadata validation

### No Cascade Violations Expected
All fixes are in utility files with isolated usage patterns. No unsafe-* violations will be automatically fixed.

---

## Risk Assessment

### Technical Risks
- **Low**: All files are utilities with clear type patterns
- **No breaking changes**: All fixes maintain existing behavior
- **Well-tested**: Test utilities have comprehensive test coverage

### Testing Strategy
1. **Unit tests**: Run existing tests for adapter-compliance
2. **Browser tests**: Manually verify PWA APIs still work
3. **Type check**: Ensure no new TypeScript errors
4. **Lint**: Verify all violations resolved

### Rollback Plan
- Each file can be reverted independently
- No cross-file dependencies
- No database or API changes

---

## Success Criteria

### Code Quality
- [ ] Zero `any` types in all 5 files
- [ ] All browser APIs properly typed with ambient declarations
- [ ] Error handling uses type guards
- [ ] Dynamic method access type-safe

### Verification
- [ ] `bun run type-check` passes
- [ ] `bun run lint` shows 0 no-explicit-any violations in target files
- [ ] All existing tests pass
- [ ] No new unsafe-* violations introduced

### Documentation
- [ ] Browser API types documented with MDN links
- [ ] Type guards have JSDoc comments
- [ ] Experimental API usage clearly marked

---

## Files Changed Summary

### Modified Files (5)
1. `/src/utils/testing/adapter-compliance.ts` - 11 violations fixed
2. `/src/utils/mobile/pwa-manager.ts` - 5 violations fixed
3. `/src/utils/mobile/performance.ts` - 4 violations fixed
4. `/src/utils/validation/metadata-typeguards.ts` - 3 violations fixed
5. `/src/utils/rate-limiter.ts` - 2 violations fixed

### New Files (2)
1. `/src/types/browser-apis/pwa-apis.d.ts` - PWA API type definitions
2. `/src/types/browser-apis/network-information.d.ts` - Network Information API types

**Total Changes**: 7 files (5 modified, 2 new)

---

## Post-Implementation Validation

### Automated Checks
```bash
# Type check
bun run type-check

# Lint specific files
bun run lint src/utils/testing/adapter-compliance.ts
bun run lint src/utils/mobile/pwa-manager.ts
bun run lint src/utils/mobile/performance.ts
bun run lint src/utils/validation/metadata-typeguards.ts
bun run lint src/utils/rate-limiter.ts

# Run tests
bun test src/utils/testing/__tests__
bun test src/utils/mobile/__tests__
```

### Manual Verification
1. **PWA APIs**: Test install prompt and badge APIs on mobile
2. **Performance monitoring**: Verify metrics collection still works
3. **Adapter compliance**: Run compliance tests against sample adapters
4. **Type guards**: Verify metadata validation in metadata enrichment flow

---

## Integration with Wave 1

### Current Wave 1 Progress
- Batch 1: 24 violations ✅
- Batch 2: 25 violations ✅
- Batch 3: 23 violations ✅
- **Batch 4: 25 violations** ← We are here
- Remaining: 53 violations (Batches 5-6)

### Wave 1 Completion Target
- **Target**: 150 violations
- **After Batch 4**: 97/150 (64.7%)
- **Remaining**: 53 violations

### Next Batches Preview
**Batch 5 Candidates** (20-25 violations):
- Browser API compatibility (orientation.ts - partial)
- Additional mobile utilities
- Validation utilities

**Batch 6 Candidates** (remaining ~25-30 violations):
- Complete orientation.ts
- Remaining test utilities
- Final Wave 1 cleanup

---

## Lessons Learned from Batches 1-3

### Successful Patterns
1. ✅ **Type guards over assertions**: Using type predicates instead of `as any`
2. ✅ **Ambient declarations**: Creating .d.ts files for browser APIs
3. ✅ **Unknown first**: Starting with `unknown` then narrowing
4. ✅ **Small batches**: 20-25 violations per batch is manageable

### Patterns to Apply
1. **Browser APIs**: Create comprehensive ambient declarations
2. **Error handling**: Consistent error type guard pattern
3. **Dynamic access**: Type-safe helpers for property/method access
4. **Testing**: Maintain test utilities at same quality as production code

### Metrics from Previous Batches
- **Batch 1**: 4 hours actual (3-4 estimated) ✅
- **Batch 2**: 5 hours actual (4-6 estimated) ✅
- **Batch 3**: 3 hours actual (2-3 estimated) ✅
- **Average**: ~4 hours per 24 violations

**Batch 4 Estimate**: 3-4 hours (confident based on historical data)

---

## Conclusion

Batch 4 represents a well-balanced selection of low-risk utility files that follow established patterns from Batches 1-3. The focus on browser APIs, testing utilities, and type guards aligns with Wave 1's goal of building a foundation of type safety before tackling more complex areas.

**Key Strengths**:
- All files are utilities with clear type patterns
- No dependencies on complex business logic
- Browser APIs can be properly typed with ambient declarations
- Testing utilities improve developer experience

**Recommendation**: ✅ **Proceed with implementation**

This batch will bring Wave 1 to 64.7% completion, setting up for a strong finish with Batches 5-6.

---

*Generated by Claude Code*
*Part of ESLint Remediation Phase 1*
*Last Updated: 2025-11-08*
