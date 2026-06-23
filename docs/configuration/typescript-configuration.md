# TypeScript Configuration Guide

This document explains the TypeScript configuration structure and type safety practices in the Mugiwara-Kaizoku project.

## Configuration Files

The project uses a simplified TypeScript configuration structure:

1. **tsconfig.json**: Main configuration for the entire project
2. **tsconfig.test.json**: Configuration specific to tests

## Core Configuration Principles

### 1. Standard Configuration

The main `tsconfig.json` provides a standardized configuration for the entire project:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 2. Module Resolution

The project uses the Node.js module resolution strategy enhanced with path aliases:

```json
"moduleResolution": "bundler",
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

This enables imports like `import { Component } from '@/components/Component'` from any file.

### 3. Incremental Builds

Incremental builds are enabled to improve TypeScript checking performance:

```json
"incremental": true
```

## Strictness Settings

The project uses the `strict` flag which enables a comprehensive set of type checking behaviors:

```json
"strict": true
```

This enables all of the following settings:
- `noImplicitAny`: Raise error on expressions and declarations with an implied 'any' type
- `strictNullChecks`: Enable strict null checking
- `strictFunctionTypes`: Enable strict checking of function types
- `strictBindCallApply`: Enable strict 'bind', 'call', and 'apply' methods on functions
- `strictPropertyInitialization`: Ensure non-undefined class properties are initialized
- `noImplicitThis`: Raise error on 'this' expressions with an implied 'any' type
- `alwaysStrict`: Parse in strict mode and emit "use strict" for each source file

## TypeScript Scripts

The project includes several scripts to help with TypeScript development:

- `bun run type-check`: Run TypeScript type checking with `tsc --noEmit`
- `bun run build`: TypeScript compilation as part of the build process

## Type Definitions and Type Safety Features

The project includes extensive type definitions and type safety features:

### Core Type Definitions

Custom type definitions are located in `src/types/`:

- **prismaTypes.ts**: Type definitions derived from Prisma models
- **auth-types.d.ts**: Authentication system types
- **component-types.ts**: React component type definitions
- **prisma-exports.ts**: Type exports from Prisma models
- **prisma-transaction.ts**: Types for transaction handling

### Advanced Type Safety Features

The project implements several advanced type safety features:

1. **Discriminated Unions** (`src/types/task-unions.ts`):
   - Type-safe task handling with discriminated unions
   - Automatic type narrowing based on task type and status
   - Type guards for discriminated unions

2. **Specialized Error Types** (`src/types/error-types.ts`):
   - Comprehensive error class hierarchy
   - Type-safe error handling with specialized error types
   - Type guards for error types

3. **Type Guards** (`src/utils/type-guards.ts`):
   - Reusable type guards for common data structures
   - Generic type parameters for flexible type checking
   - Predicate functions for type narrowing

4. **API Response Typing** (`src/utils/api-response.ts`):
   - Type-safe API response handling
   - Success/error discrimination
   - Response transformation utilities

## Related Documentation

For more detailed information on TypeScript in this project, refer to:

- **TypeScript Safety Improvements**: Comprehensive guide to type safety patterns used in the project
- **Future TypeScript Improvements**: Roadmap for future type safety enhancements

## Type Safety Best Practices

The project follows these type safety best practices:

1. **Avoid Type Assertions**
   - Avoid using `as` type assertions whenever possible
   - Use type guards instead of type assertions
   - Create conversion functions for complex types

   ```typescript
   // ❌ Avoid
   const result = data as ComplexType;

   // ✅ Do this instead
   if (isComplexType(data)) {
     const result: ComplexType = data;
     // Use result safely
   }
   ```

2. **Use Discriminated Unions**
   - Use discriminated unions for complex type relationships
   - Create type guards for discriminated unions
   - Leverage automatic type narrowing

   ```typescript
   type Result<T> = 
     | { status: 'success'; data: T }
     | { status: 'error'; error: Error };

   function handleResult<T>(result: Result<T>) {
     if (result.status === 'success') {
       // TypeScript knows result.data exists here
       processData(result.data);
     } else {
       // TypeScript knows result.error exists here
       handleError(result.error);
     }
   }
   ```

3. **Null Safety**
   - Use optional chaining (`?.`) for potentially null/undefined values
   - Use nullish coalescing (`??`) for default values
   - Avoid non-null assertions (`!`) when possible

   ```typescript
   // ❌ Avoid
   const title = manga && manga.metadata && manga.metadata.title || 'Unknown';

   // ✅ Do this instead
   const title = manga?.metadata?.title ?? 'Unknown';
   ```

4. **Type Guards**
   - Create proper type guards for complex types
   - Use type predicates (`is` keyword) for type narrowing
   - Implement comprehensive validation in type guards

   ```typescript
   function isUser(value: unknown): value is User {
     if (!value || typeof value !== 'object') return false;
     const obj = value as Record<string, unknown>;
     return (
       'id' in obj && typeof obj.id === 'number' &&
       'name' in obj && typeof obj.name === 'string' &&
       'email' in obj && typeof obj.email === 'string'
     );
   }
   ```

5. **Error Handling**
   - Use specialized error types for different error scenarios
   - Implement type guards for error types
   - Use try/catch with proper error typing

   ```typescript
   try {
     // Operation that might fail
   } catch (error) {
     if (isApiError(error)) {
       // Handle API error specifically
       console.error(`API Error on ${error.endpoint}: ${error.message}`);
     } else if (isDatabaseError(error)) {
       // Handle database error specifically
       console.error(`Database Error during ${error.operation}: ${error.message}`);
     } else {
       // Handle other errors
       console.error(`Unexpected error: ${getErrorMessage(error)}`);
     }
   }
   ```

## Troubleshooting

If you encounter TypeScript errors:

1. **Run Type Check**: Use `bun run type-check` to identify errors
2. **Check Type Guards**: Ensure type guards are properly implemented
3. **Verify Discriminated Unions**: Make sure discriminated unions are correctly typed
4. **Validate Null Handling**: Check for proper null/undefined handling
5. **Review Error Handling**: Ensure error handling follows type-safe patterns

For common patterns and solutions, consult:
- [TypeScript Patterns](../typescript/typescript-patterns.md) - Reference for common TypeScript patterns used in this project
- TypeScript Fixes Summary - Summary of recent fixes to TypeScript errors
- TypeScript Error Resolution Patterns - Common error patterns and their solutions

For any TypeScript-related issues, consult the TypeScript Safety Improvements documentation.
