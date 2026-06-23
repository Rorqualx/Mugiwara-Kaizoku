# Testing Guide

*Status: Active*  
*Canonical: Yes*

## Overview

Comprehensive testing guide for the Mugiwara Kaizoku project, covering testing strategies, best practices, and implementation guidelines.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Strategy](#testing-strategy)
3. [Test Types](#test-types)
4. [Writing Tests](#writing-tests)
5. [Running Tests](#running-tests)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Testing Philosophy

### Core Principles
- Test behavior, not implementation
- Write tests that are maintainable
- Focus on critical user paths
- Balance coverage with practicality

### Testing Pyramid
```
         /\
        /E2E\
       /------\
      /  Integ \
     /----------\
    /    Unit    \
   /--------------\
```

## Testing Strategy


### Coverage Goals
- Unit tests: 80% coverage
- Integration tests: Critical paths
- E2E tests: User workflows
- Performance tests: Key operations

## Test Types

### Unit Tests
Testing individual components and functions in isolation.

```typescript
describe('MangaService', () => {
  it('should fetch manga by ID', async () => {
    const manga = await service.getMangaById('123');
    expect(manga).toBeDefined();
    expect(manga.id).toBe('123');
  });
});
```

### Integration Tests
Testing component interactions and API endpoints.


### E2E Tests
Testing complete user workflows.


## Writing Tests


### Test Structure
```typescript
// Arrange
const testData = createTestData();

// Act
const result = await performAction(testData);

// Assert
expect(result).toMatchExpectedOutcome();
```

### Common Patterns

## Running Tests

### Two Runners (by design)

The project intentionally uses two test runners with disjoint territories:

| Runner | Territory | Setup file | Invocation |
|--------|-----------|------------|------------|
| **Jest** (ts-jest, jsdom) | `src/**` component/UI tests — rely on `jest.mock()` module factories | `src/test/setup.ts` (17 mock modules) | `npm test` |
| **Bun** (`bun:test`, happy-dom) | `tests/**` server/unit/integration suites | `tests/setup.ts` (Jest-compat shims) | `bun run test:bun` |
| **Playwright** | `tests/e2e/**` | — | `npm run test:e2e` |

The PreToolUse edit hook (`run-related-tests.py`) runs related tests with
**bun**, so server-side tests must stay bun-compatible.

### ⚠️ Bun invocation rules

- **Always use `bun run test:bun`** (or pass absolute paths). Relative
  filter args like `bun test tests/` trigger a full-tree glob scan that
  breaks child-process reaping on bun 1.3.x — spawned tools (`lsar`,
  `unar`) report exit 1 with empty stdout, false-failing the packImport
  suites. The filter is also a substring match that sweeps in
  `tests/e2e` (Playwright errors) and `archive/*/tests/` (deleted-module
  errors); bunfig's `exclude` is not honored for positional filters.
- `jest.requireActual()` is **not supported** under bun — it throws.
  Import the module directly instead.
- Fake timers (`jest.useFakeTimers`/`advanceTimersByTime`) are native in
  bun ≥ 1.3, but `advanceTimersByTimeAsync` is still missing — prefer
  real timers (project convention).

### Commands
```bash
# Jest (src/ component tests)
npm test
npm run test:coverage

# Bun (tests/ server suites) — canonical invocation
bun run test:bun
bun run test:bun:watch

# Playwright E2E
npm run test:e2e
```

### CI/CD Integration
- Tests run on every PR
- Coverage reports generated
- Performance benchmarks tracked

## Best Practices


### Do's
- ✅ Use descriptive test names
- ✅ Keep tests independent
- ✅ Mock external dependencies
- ✅ Test edge cases
- ✅ Clean up after tests

### Don'ts
- ❌ Test implementation details
- ❌ Share state between tests
- ❌ Use hard-coded values
- ❌ Skip flaky tests
- ❌ Test framework code

## Troubleshooting


### Common Issues
1. **Flaky Tests**: Use proper async handling
2. **Slow Tests**: Mock heavy operations
3. **Failed Setup**: Check dependencies
4. **Memory Leaks**: Clean up resources

---

## Related Documentation
- [Development Guide](../development/development-guide.md)
- [CI/CD Pipeline](../development/ci-cd-workflows.md)
- Code Quality Standards
