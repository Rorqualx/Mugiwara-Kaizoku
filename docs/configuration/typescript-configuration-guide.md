# Typescript Configuration Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Configuration Guide

---
# TypeScript Configuration for Error Prevention

## Recommended tsconfig.json Settings

Add these settings to your `tsconfig.json` to catch errors during development:

```json
{
  "compilerOptions": {
    // Strict Type Checking
    "strict": true,                           // Enable all strict type checking options
    "noImplicitAny": true,                   // Error on expressions with 'any' type
    "strictNullChecks": true,                // Enable strict null checks
    "strictFunctionTypes": true,             // Strict checking of function types
    "strictBindCallApply": true,             // Strict 'bind', 'call', and 'apply'
    "strictPropertyInitialization": true,    // Strict property initialization
    "noImplicitThis": true,                  // Error on 'this' with 'any' type
    "alwaysStrict": true,                    // Ensure 'use strict' in all files

    // Additional Checks
    "noUnusedLocals": true,                  // Error on unused local variables
    "noUnusedParameters": true,              // Error on unused parameters
    "noImplicitReturns": true,               // Error when not all paths return
    "noFallthroughCasesInSwitch": true,     // Error on fallthrough cases
    "noUncheckedIndexedAccess": true,        // Add undefined to index signatures
    "noImplicitOverride": true,              // Require override modifier
    "noPropertyAccessFromIndexSignature": true, // Require indexed access

    // Module Resolution
    "esModuleInterop": true,                 // Enable interop between CommonJS and ES
    "allowSyntheticDefaultImports": true,    // Allow default imports
    "resolveJsonModule": true,               // Include JSON modules
    "isolatedModules": true,                 // Ensure each file can be transpiled

    // Type Safety
    "exactOptionalPropertyTypes": true,      // Differentiate between undefined and missing
    "forceConsistentCasingInFileNames": true, // Disallow inconsistent file name casing
    
    // React Specific
    "jsx": "preserve",                       // Preserve JSX for Next.js
    "skipLibCheck": true,                    // Skip type checking of declaration files
    
    // Path Mapping (REQUIRED — always import via @/ aliases;
    // deep relative imports are blocked by ESLint no-restricted-imports)
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src/**/*",
    "pages/**/*",
    "prisma/**/*"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "dist",
    "build"
  ]
}
```

## IDE Configuration

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  // TypeScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "typescript.updateImportsOnFileMove.enabled": "always",
  
  // ESLint
  "eslint.enable": true,
  "eslint.run": "onType",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  
  // Editor
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  
  // Files
  "files.exclude": {
    "**/*.fixed.ts": true,
    "**/*.fixed.tsx": true
  }
}
```

## Type Declaration Files

Create these type declaration files to enhance type safety:

### src/types/global.d.ts
```typescript
// Global type enhancements
declare global {
  // Ensure ID type is available globally
  type ID = string | number;
  
  // Add custom utility types
  type Nullable<T> = T | null;
  type Optional<T> = T | undefined;
  type MaybeNull<T> = T | null | undefined;
  
  // Enhanced error types
  interface TypedError extends Error {
    code?: string;
    context?: Record<string, unknown>;
  }
}

export {};
```

### src/types/mantine.d.ts
```typescript
// Mantine v7 type corrections
import '@mantine/core';

declare module '@mantine/core' {
  // Remove deprecated props from types
  interface TextProps {
    weight?: never; // This will cause error if used
  }
  
  interface GroupProps {
    spacing?: never;
    position?: never;
  }
  
  interface StackProps {
    spacing?: never;
  }
  
  interface ProgressProps {
    animate?: never;
  }
  
  interface MultiSelectProps {
    creatable?: never;
  }
}
```

### src/types/trpc.d.ts
```typescript
// tRPC v11 type enhancements
import { UseTRPCQueryResult } from '@trpc/react-query';

declare module '@trpc/react-query' {
  interface UseTRPCQueryResult {
    isLoading?: never; // Force use of isPending
  }
  
  interface UseTRPCMutationResult {
    isLoading?: never; // Force use of isPending
  }
}
```

## Utility Type Guards

Create `src/utils/type-guards.ts`:

```typescript
// Comprehensive type guards for the project

export function isValidId(value: unknown): value is ID {
  return typeof value === 'string' || typeof value === 'number';
}

export function isNumericId(id: ID): id is number {
  return typeof id === 'number';
}

export function isStringId(id: ID): id is string {
  return typeof id === 'string';
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function isTypedError(error: unknown): error is TypedError {
  return isError(error) && ('code' in error || 'context' in error);
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
```

## Build-Time Type Checking

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch",
    "type-coverage": "typescript-coverage-report",
    "lint:types": "tsc --noEmit && eslint . --ext .ts,.tsx",
    "validate": "run-p type-check lint test"
  }
}
```

## Type Coverage Goals

Install and configure type coverage:

```bash
bun add -D typescript-coverage-report
```

Add to `package.json`:

```json
{
  "typeCoverage": {
    "minCoverage": 95,
    "strict": true,
    "ignoreFiles": [
      "**/*.test.ts",
      "**/*.spec.ts"
    ]
  }
}
```

## Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Type Check
  run: bun run type-check
  
- name: Type Coverage
  run: bun run type-coverage
  
- name: Lint Types
  run: bun run lint:types
```
