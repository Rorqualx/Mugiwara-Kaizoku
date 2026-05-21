# Testing Guide

*Status: Active*  
*Author: Testing Team*  
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

[Content from test-adoption-guide.md and test-quality-standards.md]

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

[Content from test-infrastructure-summary.md]

### E2E Tests
Testing complete user workflows.

[Content from testing-guide-unified.md]

## Writing Tests

[Content from test-template-guide.md and test-fixing-guide.md]

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
[Content from test-fixes-patterns.md]

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### CI/CD Integration
- Tests run on every PR
- Coverage reports generated
- Performance benchmarks tracked

## Best Practices

[Content from test-quality-standards.md]

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

[Content from test-debugging-guide.md]

### Common Issues
1. **Flaky Tests**: Use proper async handling
2. **Slow Tests**: Mock heavy operations
3. **Failed Setup**: Check dependencies
4. **Memory Leaks**: Clean up resources

---

## Related Documentation
- [Development Guide](../development/development-guide.md)
- [CI/CD Pipeline](../development/ci-cd-workflows.md)
- [Code Quality Standards](../development/code-quality.md)
