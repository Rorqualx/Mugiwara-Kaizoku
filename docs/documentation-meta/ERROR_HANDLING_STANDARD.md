# Error Handling Standard

## Overview
This document defines the error handling standard for the Kaizoku codebase. All new code must follow these patterns, and existing code should be migrated when modified.

## Core Principles

1. **No console.* usage** - Use the logger system instead
2. **Typed errors** - Use domain-specific error classes
3. **Consistent error handling** - Use AsyncResult pattern for all async operations
4. **Proper error context** - Include relevant context in error messages

## Logger System

### Import
```typescript
import { logger } from '@/utils/logger';
```

### Usage
```typescript
// Debug level
logger.debug('Processing request', { requestId: '123' });

// Info level  
logger.info('Server started', { port: 3000 });

// Warning level
logger.warn('Rate limit approaching', { remaining: 10 });

// Error level
logger.error('Database connection failed', error, { 
  host: 'localhost',
  attempt: 3 
});

// Fatal level
logger.fatal('System critical failure', error);
```

### Child Loggers
```typescript
import { createChildLogger } from '@/utils/logger';

const moduleLogger = createChildLogger({ 
  component: 'MetadataService' 
});
```

## Error Classes

### Base Error
All custom errors extend from BaseError:

```typescript
import { BaseError } from '@/utils/errors/base-error';

export class CustomError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'CUSTOM_ERROR', 500, context);
  }
}
```

### Domain-Specific Errors

```typescript
import { 
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  DatabaseError,
  ExternalApiError 
} from '@/utils/errors';

// Usage
throw new ValidationError('Invalid input', {
  field: 'email',
  value: userInput
});

throw new NotFoundError('User not found', {
  userId: id
});
```

## AsyncResult Pattern

### Creating Results
```typescript
import { 
  createSuccessResult, 
  createErrorResult,
  createLoadingResult,
  createIdleResult 
} from '@/utils/async-result';

async function fetchData(): Promise<AsyncResult<Data>> {
  try {
    const data = await api.get('/data');
    return createSuccessResult(data);
  } catch (error) {
    logger.error('Failed to fetch data', error);
    return createErrorResult(error);
  }
}
```

### Handling Results
```typescript
import { isSuccess, isError, isLoading } from '@/utils/async-result';

const result = await fetchData();

if (isSuccess(result)) {
  logger.info('Data fetched successfully');
  processData(result.data);
} else if (isError(result)) {
  logger.error('Data fetch failed', result.error);
  handleError(result.error);
}
```

## Migration Guide

### From console.* to logger

**Before:**
```typescript
console.log('User logged in', userId);
console.error('Login failed:', error);
```

**After:**
```typescript
logger.info('User logged in', { userId });
logger.error('Login failed', error);
```

### From try/catch to AsyncResult

**Before:**
```typescript
async function getUser(id: string) {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    console.error('Failed to get user:', error);
    throw error;
  }
}
```

**After:**
```typescript
async function getUser(id: string): Promise<AsyncResult<User>> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return createErrorResult(
        new NotFoundError('User not found', { userId: id })
      );
    }
    return createSuccessResult(user);
  } catch (error) {
    logger.error('Failed to get user', error, { userId: id });
    return createErrorResult(
      new DatabaseError('Failed to get user', { userId: id }, error)
    );
  }
}
```

## ESLint Configuration

The following ESLint rule is enforced to prevent console usage:

```json
{
  "rules": {
    "no-console": ["error", {
      "allow": ["warn", "error"]
    }]
  }
}
```

Scripts and configuration files are exempt from this rule.

## Testing

When testing error handling:

```typescript
import { createErrorResult, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';

describe('Error handling', () => {
  it('should handle validation errors', async () => {
    const result = await validateInput('invalid');
    
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
```

## Environment-Specific Behavior

### Server-Side
- Logs written to files in `/logs` directory
- Colored console output in development
- JSON format in production

### Client-Side  
- Console output with styling in development
- Buffered logging in production
- Automatic error reporting integration

## Best Practices

1. **Always include context** - Add relevant data to help debug issues
2. **Use appropriate log levels** - Don't use error for warnings
3. **Create child loggers** - For module-specific context
4. **Handle all error cases** - Never ignore errors silently
5. **Use domain errors** - Create specific error classes for your domain
6. **Test error paths** - Ensure error handling works correctly

## Examples

### Service Implementation
```typescript
import { logger, createChildLogger } from '@/utils/logger';
import { DatabaseError, ValidationError } from '@/utils/errors';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';

export class UserService {
  private logger = createChildLogger({ service: 'UserService' });
  
  async createUser(data: CreateUserDto): Promise<AsyncResult<User>> {
    this.logger.info('Creating user', { email: data.email });
    
    // Validation
    if (!data.email.includes('@')) {
      return createErrorResult(
        new ValidationError('Invalid email', { 
          field: 'email', 
          value: data.email 
        })
      );
    }
    
    try {
      const user = await prisma.user.create({ data });
      this.logger.info('User created successfully', { userId: user.id });
      return createSuccessResult(user);
    } catch (error) {
      this.logger.error('Failed to create user', error, { email: data.email });
      return createErrorResult(
        new DatabaseError('Failed to create user', { email: data.email }, error)
      );
    }
  }
}
```

### API Route
```typescript
import { logger } from '@/utils/logger';
import { isSuccess, isError } from '@/utils/async-result';

export async function POST(req: Request) {
  const data = await req.json();
  logger.info('Received user creation request', { email: data.email });
  
  const result = await userService.createUser(data);
  
  if (isSuccess(result)) {
    return Response.json(result.data, { status: 201 });
  }
  
  if (isError(result)) {
    const error = result.error;
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
}
```

## Migration Status

- ✅ Core error system implemented
- ✅ Logger system created  
- ✅ Migration script executed
- ✅ ESLint rules configured
- ⏳ Ongoing migration of legacy code

For questions or improvements to this standard, please open an issue or PR.