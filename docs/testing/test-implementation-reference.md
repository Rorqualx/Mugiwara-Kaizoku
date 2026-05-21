# Test Implementation Reference

*Status: Active*  
*Author: Testing Team*  
*Canonical: Yes*

## Overview

Technical reference for test implementations, fixes, and specific test plans.

---

## Table of Contents

1. [Test Plans](#test-plans)
2. [Test Fixes History](#test-fixes-history)
3. [TypeScript Test Patterns](#typescript-test-patterns)
4. [Migration Strategies](#migration-strategies)
5. [Infrastructure Details](#infrastructure-details)

## Test Plans

### AniList Integration Tests
[Content from ANILIST_TEST_PLAN.md]

### Kapowarr Phase 7 Testing
[Content from kapowarr-phase7-testing-plan.md]

### Suwayomi Test Suite
[Content from suwayomi-test-suite-summary.md]

## Test Fixes History

### Recent Fixes
[Content from test-fixes-summary.md and test-fixes-complete-report.md]

### TypeScript Test Updates
[Content from typescript-fixes-test-files.md and template-test-files-typescript-fixes.md]

### Provider Selection Form Tests
[Content from provider-selection-form-latest-fixes.md]

## TypeScript Test Patterns

[Content from typescript-fixes-summary-latest.md and typescript-fixes-progress-update-latest.md]

### Type-Safe Mocking
```typescript
const mockService = createMock<MangaService>({
  getManga: jest.fn().mockResolvedValue(testManga)
});
```

### Testing Async Operations
```typescript
it('handles async operations', async () => {
  await expect(asyncOperation()).resolves.toBe(expected);
});
```

## Migration Strategies

[Content from test-migration-plan.md]

### Legacy Test Migration
1. Identify outdated patterns
2. Update to modern syntax
3. Add TypeScript types
4. Improve assertions
5. Remove deprecated APIs

## Infrastructure Details

[Content from test-infrastructure-summary.md]

### Test Environment
- Node.js version: 18+
- Test runner: Jest
- Test utilities: Testing Library
- Mocking: MSW for API mocks

---

## Appendix

### Useful Commands
```bash
# Debug specific test
npm test -- --testNamePattern="test name"

# Update snapshots
npm test -- -u

# Run tests in watch mode
npm test -- --watch
```
