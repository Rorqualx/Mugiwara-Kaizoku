# API Integration Tests

This directory contains integration tests for the Kaizoku API endpoints.

## Running Tests

### Run all integration tests
```bash
npm run test:api
```

### Run tests with coverage
```bash
npm run test:api:coverage
```

### Run specific test file
```bash
npm run test:api -- manga.test.ts
```

### Run tests in watch mode
```bash
npm run test:api:watch
```

## Test Structure

```
__tests__/
├── integration/          # Integration tests for API endpoints
│   ├── health.test.ts   # Health check endpoint tests
│   ├── manga.test.ts    # Manga CRUD endpoint tests
│   ├── webhooks.test.ts # Webhook management tests
│   └── metadata.test.ts # Metadata provider tests
├── jest.config.js       # Jest configuration
├── setup.ts            # Test setup and custom matchers
└── README.md           # This file
```

## Writing Tests

### Basic test structure
```typescript
import { createMocks } from 'node-mocks-http';
import handler from '../../../../pages/api/v1/endpoint';

describe('API Endpoint', () => {
  it('should handle request', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        'x-api-key': 'test-key',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toBeValidApiResponse();
  });
});
```

### Custom Matchers

The test setup includes custom Jest matchers for API responses:

#### `toBeValidApiResponse()`
Checks if the response has the correct API response format:
```typescript
expect(response).toBeValidApiResponse();
```

#### `toHaveApiError(code?)`
Checks if the response contains an API error, optionally with a specific code:
```typescript
expect(response).toHaveApiError();
expect(response).toHaveApiError('VALIDATION_ERROR');
```

## Mocking

### Database mocks
All Prisma database calls are mocked:
```typescript
import { prisma } from '../../../../lib/prisma';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    manga: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// In tests
(prisma.manga.findMany as jest.Mock).mockResolvedValue([...]);
```

### Authentication mocks
API authentication is mocked for tests:
```typescript
import { apiAuthService } from '../../services/apiAuth';

jest.mock('../../services/apiAuth', () => ({
  apiAuthService: {
    validateApiKey: jest.fn(),
  },
}));

// Mock successful auth
(apiAuthService.validateApiKey as jest.Mock).mockResolvedValue({
  status: 'success',
  data: {
    apiKey: 'test-key',
    userId: 'user-123',
    permissions: [...],
  },
});
```

## Test Coverage

The tests aim for at least 70% coverage across:
- Branches
- Functions
- Lines
- Statements

Run coverage report:
```bash
npm run test:api:coverage
```

## Environment Variables

Test environment variables are set in `setup.ts`:
- `NODE_ENV=test`
- `DATABASE_URL` - Test database connection
- `AUTH_SECRET` - Test authentication secret
- `NEXT_PUBLIC_APP_URL` - Test app URL

## Debugging Tests

### Run single test
```typescript
it.only('should test something', async () => {
  // This test will run in isolation
});
```

### Skip test
```typescript
it.skip('should test something', async () => {
  // This test will be skipped
});
```

### Debug output
```typescript
// Temporarily enable console.log for debugging
console.log = console.info;
```

## Best Practices

1. **Mock external dependencies** - Don't make real API calls or database queries
2. **Test both success and error cases** - Include validation errors, not found, permissions
3. **Use descriptive test names** - Should describe what is being tested and expected outcome
4. **Test edge cases** - Empty arrays, null values, invalid inputs
5. **Keep tests isolated** - Each test should be independent
6. **Use beforeEach** - Reset mocks between tests
7. **Test authentication** - Verify endpoints require proper authentication
8. **Test permissions** - Verify endpoints check correct permissions