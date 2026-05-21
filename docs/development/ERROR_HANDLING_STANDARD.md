# Error Handling Standard

## Overview
This document defines the standard error handling and logging patterns for the Mugiwara-Kaizoku codebase. All code must follow these patterns to ensure consistent error handling, proper logging, and effective debugging.

## Core Principles

1. **No console.* in production code** - Use the logger system
2. **Type-safe error handling** - Always check error types before accessing properties
3. **Preserve stack traces** - Never stringify errors losing context
4. **Include context** - Always log with meaningful context
5. **Use domain errors** - Use specific error classes, not generic Error

## Error Classes

### Base Error
All application errors extend from `BaseError`:

```typescript
import { BaseError, ErrorContext } from '@/utils/errors';

// BaseError provides:
// - Unique error ID
// - Error code
// - HTTP status code
// - Timestamp
// - Context
// - Cause (wrapped error)
```

### Domain-Specific Errors

Use the appropriate error class for your domain:

```typescript
import {
  ValidationError,      // 400 - Invalid input
  NotFoundError,        // 404 - Resource not found
  AuthenticationError,  // 401 - Not authenticated
  AuthorizationError,   // 403 - Not authorized
  DatabaseError,        // 500 - Database operations
  ExternalApiError,     // 502 - External API failures
  QueueError,          // 500 - Background job failures
  FileSystemError,     // 500 - File operations
  NetworkError,        // 503 - Network issues
  ConfigurationError,  // 500 - Config problems
  BusinessLogicError,  // 400 - Business rule violations
  RateLimitError,      // 429 - Rate limiting
  ConflictError,       // 409 - Resource conflicts
  TimeoutError,        // 504 - Operation timeouts
  IntegrationError     // 502 - Integration failures
} from '@/utils/errors';
```

### Creating Errors

```typescript
// ✅ GOOD - Specific error with context
throw new ValidationError(
  'Invalid email format',
  'email',                    // field name
  userInput.email,           // value
  { userId: user.id }        // context
);

// ✅ GOOD - Not found with resource info
throw new NotFoundError('User', userId);

// ✅ GOOD - External API error with details
throw new ExternalApiError(
  'GitHub',
  'Failed to fetch repositories',
  response.status,
  response.data,
  { endpoint: '/user/repos' },
  originalError
);

// ❌ BAD - Generic error
throw new Error('Something went wrong');

// ❌ BAD - String throwing
throw 'Error occurred';
```

## Logging

### Logger Usage

```typescript
import { logger } from '@/utils/logger';

// Create child logger with context
const log = logger.child({ 
  component: 'UserService',
  userId: user.id 
});

// Log levels
log.debug('Detailed debug information');
log.info('General information');
log.warn('Warning conditions');
log.error('Error conditions', error);
log.fatal('Fatal errors requiring immediate attention', error);
```

### Logging Patterns

```typescript
// ✅ GOOD - Error with context
logger.error('Failed to save user', error, {
  userId: user.id,
  operation: 'createUser',
  input: { email: user.email }
});

// ✅ GOOD - Structured logging
logger.info('User created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date()
});

// ❌ BAD - No context
logger.error('Error');

// ❌ BAD - String concatenation
logger.error(`Error: ${error}`);  // Loses stack trace

// ❌ NEVER - Console in production
console.log('User created');
console.error(error);
```

## Error Handling Patterns

### Try-Catch Blocks

```typescript
// ✅ GOOD - Proper error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Type-safe error handling
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', error);
    return defaultValue;
  }
  
  if (error instanceof NetworkError && error.isTimeout()) {
    logger.error('Operation timed out', error);
    throw new TimeoutError('Service unavailable', 30000);
  }
  
  // Wrap unknown errors
  const wrapped = new IntegrationError(
    'ServiceName',
    'Operation failed',
    { operation: 'riskyOperation' },
    error instanceof Error ? error : undefined
  );
  
  logger.error('Unexpected error', wrapped);
  throw wrapped;
}

// ❌ BAD - Unsafe property access
catch (error) {
  console.error(error.message);  // Type error if not Error
}

// ❌ BAD - Information loss
catch (error) {
  throw new Error(`Failed: ${error}`);  // Loses stack
}
```

### AsyncResult Integration

```typescript
import { errorHandler } from '@/utils/error-handler';
import { isSuccess, isError } from '@/utils/async-result';

// Using error handler
const result = await errorHandler.handle(
  async () => await fetchData(),
  'fetchUserData',
  { metadata: { userId } }
);

if (isSuccess(result)) {
  return result.data;
}

if (isError(result)) {
  // Error already logged by handler
  return defaultValue;
}

// With retry logic
const retryResult = await errorHandler.retry(
  async () => await unstableOperation(),
  {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2,
    context: 'sync-data',
    shouldRetry: (error) => error.is(NetworkError)
  }
);
```

### Express Middleware

```typescript
// Error handling middleware
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  const log = logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url
  });
  
  if (error instanceof BaseError) {
    log.error('Request failed', error);
    res.status(error.statusCode).json({
      error: {
        id: error.id,
        code: error.code,
        message: error.getUserMessage()
      }
    });
  } else {
    log.error('Unhandled error', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      }
    });
  }
});
```

### React Error Boundaries

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Wrap components with error boundary
<ErrorBoundary
  fallback={(error, reset) => (
    <ErrorDisplay error={error} onRetry={reset} />
  )}
>
  <YourComponent />
</ErrorBoundary>
```

## Database Error Handling

```typescript
import { DatabaseError } from '@/utils/errors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

try {
  const user = await prisma.user.create({ data });
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictError('User already exists', 'user');
    }
    if (error.code === 'P2003') {
      throw new ValidationError('Invalid foreign key reference');
    }
  }
  
  throw new DatabaseError(
    'Failed to create user',
    'create',
    'user',
    { data },
    error instanceof Error ? error : undefined
  );
}
```

## API Error Responses

```typescript
// Consistent error response format
interface ErrorResponse {
  error: {
    id: string;        // Unique error ID for tracking
    code: string;      // Error code (e.g., 'VALIDATION_ERROR')
    message: string;   // User-friendly message
    details?: any;     // Additional details (dev mode only)
    timestamp: string; // ISO timestamp
  };
}

// Example response
{
  "error": {
    "id": "ValidationError-1234567890-abc123",
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Testing Error Handling

```typescript
import { ValidationError, NotFoundError } from '@/utils/errors';

describe('UserService', () => {
  it('should handle validation errors', async () => {
    const service = new UserService();
    
    await expect(
      service.createUser({ email: 'invalid' })
    ).rejects.toThrow(ValidationError);
  });
  
  it('should include error context', async () => {
    try {
      await service.getUser('invalid-id');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.context).toEqual({
        resource: 'User',
        resourceId: 'invalid-id'
      });
    }
  });
});
```

## Migration Checklist

When migrating existing code:

- [ ] Replace all `console.*` with `logger.*`
- [ ] Replace generic `Error` with domain-specific errors
- [ ] Add type guards before accessing error properties
- [ ] Include context in all error creation and logging
- [ ] Wrap external errors to preserve stack traces
- [ ] Use error handler for AsyncResult integration
- [ ] Test error scenarios

## Environment Variables

```env
# Logging configuration
LOG_LEVEL=info          # debug | info | warn | error | fatal
LOG_DIR=./logs         # Directory for log files
LOG_MAX_FILES=7        # Maximum number of log files to keep
LOG_MAX_SIZE=10m       # Maximum size of each log file
```

## Common Patterns

### Pattern: Fallback on Error
```typescript
const data = await errorHandler.logAndDefault(
  error,
  [], // default value
  'fetchUserList',
  { filters }
);
```

### Pattern: Critical Failures
```typescript
errorHandler.logAndThrow(
  error,
  'critical-operation',
  { severity: 'high' }
);
```

### Pattern: Child Loggers
```typescript
class UserService {
  private log = logger.child({ service: 'UserService' });
  
  async createUser(data: CreateUserDto) {
    const log = this.log.child({ operation: 'createUser' });
    log.info('Creating user', { email: data.email });
    // ...
  }
}
```

## Monitoring Integration

Errors are automatically sent to monitoring services:
- Development: Console output only
- Staging: Console + log files
- Production: Log files + monitoring service (Sentry/DataDog)

Error IDs can be used to trace errors across services and correlate with monitoring dashboards.

## DO's and DON'Ts

### DO's ✅
- Use specific error classes
- Include context in errors
- Log at appropriate levels
- Preserve stack traces
- Type check before property access
- Use child loggers for context
- Handle specific error cases

### DON'Ts ❌
- Use console.* in production
- Throw strings or plain objects
- Stringify errors (loses stack)
- Access error.message without type check
- Log sensitive information
- Ignore errors silently
- Use generic Error class

## Support

For questions about error handling patterns, please:
1. Check this documentation
2. Review existing code examples
3. Ask in #dev-standards channel
4. Create an issue for clarification