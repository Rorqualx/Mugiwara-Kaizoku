# DEVELOPMENT_RULES

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DEVELOPMENT_RULES

---
# Development Rules to Prevent TypeScript Errors

This document defines strict rules to prevent common TypeScript errors in the Mugiwara-Kaizoku project.

## 1. ID Type Handling Rules

### Rule 1.1: ID Type Conversion
**ALWAYS** convert ID types when passing to tRPC or Prisma operations:

```typescript
// ❌ WRONG - Direct usage
mangaId: manga.id

// ✅ CORRECT - With conversion
import { toNumberId } from '@/utils/id-converters';
mangaId: toNumberId(manga.id)
```

### Rule 1.2: ID Type Utilities
Create and use these standard utilities:

```typescript
// src/utils/id-converters.ts
export const toNumberId = (id: ID): number => {
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid ID: ${id}`);
    }
    return parsed;
  }
  return id;
};

export const toStringId = (id: ID): string => {
  return String(id);
};

export const convertIdArray = (ids: ID[]): number[] => {
  return ids.map(toNumberId);
};
```

### Rule 1.3: Type Definitions
**ALWAYS** use explicit types for IDs in function parameters:

```typescript
// ❌ WRONG
function getManga(id: ID) { }

// ✅ CORRECT
function getManga(id: number) { }
// OR if flexibility needed:
function getManga(id: ID) {
  const numericId = toNumberId(id);
  // use numericId
}
```

## 2. Mantine v7 Component Rules

### Rule 2.1: Font Weight Property
**NEVER** use `weight` prop, **ALWAYS** use `fw`:

```typescript
// ❌ WRONG
<Text weight={500}>

// ✅ CORRECT
<Text fw={500}>
```

### Rule 2.2: Spacing Property
**NEVER** use `spacing` prop, **ALWAYS** use `gap`:

```typescript
// ❌ WRONG
<Group spacing="xs">
<Stack spacing="md">

// ✅ CORRECT
<Group gap="xs">
<Stack gap="md">
```

### Rule 2.3: Position Property
**NEVER** use `position` prop, use appropriate alternatives:

```typescript
// ❌ WRONG
<Group position="apart">
<Group position="center">

// ✅ CORRECT
<Group justify="space-between">
<Group justify="center">
```

### Rule 2.4: MultiSelect Creatable
**NEVER** use `creatable` prop on MultiSelect. Create a custom solution if needed:

```typescript
// ❌ WRONG
<MultiSelect creatable />

// ✅ CORRECT - Use a separate input for new items
<>
  <MultiSelect data={items} />
  <TextInput placeholder="Add new item" onKeyDown={handleAddItem} />
</>
```

### Rule 2.5: Progress Animation
**NEVER** use `animate`, **ALWAYS** use `animated`:

```typescript
// ❌ WRONG
<Progress animate />

// ✅ CORRECT
<Progress animated />
```

## 3. tRPC Client Usage Rules (v11)

### Rule 3.1: Query Syntax
**ALWAYS** use correct tRPC v11 syntax:

```typescript
// ❌ WRONG - Old syntax
trpc.settings.query.useQuery()
trpc.useQuery(['settings.get'])

// ✅ CORRECT - tRPC v11 syntax
trpc.settings.getAll.useQuery()
// OR
trpc.settings.get.useQuery({ id: 1 })
```

### Rule 3.2: Query and Mutation Loading States
**For Mutations:** use `isPending`:
```typescript
// ❌ WRONG
loading={mutation.isLoading}

// ✅ CORRECT
loading={mutation.isPending}
```

**For Queries in v11:** use appropriate state checks:
```typescript
// ✅ CORRECT - tRPC v11 query states
const query = trpc.settings.get.useQuery();
if (query.isPending) // Initial loading
if (query.isFetching) // Any loading (including refetch)
if (query.isError) // Error state
if (query.isSuccess) // Success state
```

### Rule 3.3: Error Handling
**ALWAYS** check for errors before using data:

```typescript
// ❌ WRONG
const data = query.data;

// ✅ CORRECT
if (query.isError) {
  return <Error error={query.error} />;
}
if (!query.data) {
  return <Loading />;
}
const data = query.data;
```

## 4. Prisma Schema Synchronization Rules

### Rule 4.1: Schema Updates
**BEFORE** using any Prisma model in code:
1. Verify it exists in `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Check that TypeScript recognizes the model

### Rule 4.2: Model Usage Check
**ALWAYS** verify model exists before using:

```typescript
// ❌ WRONG - Assuming model exists
await prisma.download.create(...)

// ✅ CORRECT - With type checking
// First ensure schema has:
// model Download {
//   id Int @id @default(autoincrement())
//   ...
// }
```

## 5. Import Rules

### Rule 5.1: Type-Only Imports
**ALWAYS** use `export type` for type-only exports when `isolatedModules` is enabled:

```typescript
// ❌ WRONG
export { HttpClient } from './client';

// ✅ CORRECT
export type { HttpClient } from './client';
export { createHttpClient } from './client';
```

### Rule 5.2: Path-Alias Imports
**ALWAYS** use `@/` path-alias imports (enforced by `no-restricted-imports` in `eslint.config.mjs`):

```typescript
// ❌ WRONG
import { trpc } from '../utils/trpc-client/index';

// ✅ CORRECT
import { trpc } from '@/utils/trpc-client';
```

### Rule 5.3: Module Existence
**BEFORE** importing, verify the file exists:

```typescript
// ❌ WRONG - Importing non-existent module
import { Icon } from './tabler-icons-wrapper';

// ✅ CORRECT - Use the actual module
import { IconCheck } from '@tabler/icons-react';
```

## 6. AsyncResult Pattern Rules

### Rule 6.1: Complete State Checking
**ALWAYS** check all AsyncResult states:

```typescript
// ❌ WRONG
if (result.data) {
  // use data
}

// ✅ CORRECT
if (isSuccess(result)) {
  // use result.data
} else if (isError(result)) {
  // handle result.error
} else if (isLoading(result)) {
  // show loading
} else if (isIdle(result)) {
  // handle idle state
}
```

### Rule 6.2: Error Type Safety
**ALWAYS** ensure errors are Error instances:

```typescript
// ❌ WRONG
return createErrorResult(error);

// ✅ CORRECT
return createErrorResult(
  error instanceof Error ? error : new Error(String(error))
);
```

### Rule 6.3: Type Parameter Specification
**ALWAYS** specify both type parameters for AsyncResult:

```typescript
// ❌ WRONG
const [state, setState] = useState<AsyncResult>(createIdleResult());

// ✅ CORRECT
const [state, setState] = useState<AsyncResult<DataType, Error>>(
  createIdleResult<DataType, Error>()
);
```

## 7. Null Safety Rules

### Rule 7.1: Optional Chaining
**ALWAYS** use optional chaining for potentially undefined values:

```typescript
// ❌ WRONG
manga.source.toLowerCase()

// ✅ CORRECT
manga.source?.toLowerCase()
```

### Rule 7.2: Type Guards Before Operations
**ALWAYS** validate types before operations:

```typescript
// ❌ WRONG
const filtered = data.filter(item => item.active);

// ✅ CORRECT
if (!Array.isArray(data)) {
  return [];
}
const filtered = data.filter(item => item?.active);
```

### Rule 7.3: Default Values
**ALWAYS** provide defaults using nullish coalescing:

```typescript
// ❌ WRONG
const value = config.value || 100;

// ✅ CORRECT
const value = config.value ?? 100;
```

## 8. API Contract Rules

### Rule 8.1: Interface Implementation
**ALWAYS** implement all required interface methods:

```typescript
// ❌ WRONG - Missing required method
class MyClient extends DownloadClient {
  // missing getDownloads()
}

// ✅ CORRECT
class MyClient extends DownloadClient {
  async getDownloads(): Promise<DownloadItem[]> {
    // implementation
  }
}
```

### Rule 8.2: Configuration Types
**ALWAYS** match configuration interfaces exactly:

```typescript
// ❌ WRONG - Adding non-existent properties
const config: TransmissionConfig = {
  apiKey: 'key', // TransmissionConfig doesn't have apiKey
};

// ✅ CORRECT
const config: TransmissionConfig = {
  host: 'localhost',
  port: 9091,
  username: 'user',
  password: 'pass'
};
```

## 9. Build Process Rules

### Rule 9.1: Type Checking
**ALWAYS** run type check before committing:

```bash
bun run type-check
```

### Rule 9.2: Fix Type Errors First
**NEVER** commit code with type errors. Fix them immediately.

### Rule 9.3: Use Strict Mode
Ensure `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## 10. Function Parameter Rules

### Rule 10.1: Explicit Parameter Types
**NEVER** use implicit `any`:

```typescript
// ❌ WRONG
.filter(item => item.active)
.map((item) => item.name)

// ✅ CORRECT
.filter((item: ItemType) => item.active)
.map((item: ItemType) => item.name)
```

### Rule 10.2: Destructured Parameters
**ALWAYS** type destructured parameters:

```typescript
// ❌ WRONG
getCreateLabel={(query) => `Add ${query}`}

// ✅ CORRECT
getCreateLabel={(query: string) => `Add ${query}`}
```

## 11. Advanced Development Tool Rules

### Rule 11.1: MCP (Model Context Protocol) Usage
**WHEN to use MCP:**
- Complex database queries requiring optimization
- Unfamiliar API endpoints or external services
- Tasks that would save >5 minutes of research

**WHEN NOT to use MCP:**
- Security-sensitive operations (credentials, production data)
- Simple CRUD operations you know by heart
- Code patterns (use `ast-grep` instead)
- Commits (use `/commit` instead)

**ALWAYS validate MCP outputs:**
```bash
bun run type-check  # No errors
bun run lint        # No errors
ast-grep --pattern 'any' src/  # No matches
```

**Documentation:** See `/docs/development/MCP usage/MCP_QUICK_REFERENCE.md`

### Rule 11.2: Agent Orchestration
**WHEN to orchestrate:**
- Complexity: 3+ independent subtasks
- Duration: 30+ minutes of work
- Parallelization: Obviously possible

**WHEN NOT to orchestrate:**
- Same file modifications (use sequential)
- Shared mutable state
- Simple sequential workflows

**ALWAYS validate after each wave:**
```bash
bun run type-check
bun run lint
bun test  # If code changed
```

**CRITICAL RULES:**
- Max 5 parallel agents
- Validate after EVERY wave
- Stop if ANY validation fails
- Check for dependency cycles

**Documentation:** See `/docs/development/Agents usage/AGENT_ORCHESTRATION_QUICK_REFERENCE.md`

## Enforcement Checklist

Before committing any code:

- [ ] All IDs converted to correct type when passed to APIs
- [ ] All Mantine components use v7 props
- [ ] All tRPC queries use v11 syntax
- [ ] All imports are type-safe and exist
- [ ] All AsyncResult usage includes proper type guards
- [ ] All nullable values handled with optional chaining
- [ ] All function parameters have explicit types
- [ ] `bun run type-check` passes without errors
- [ ] No `any` types without explicit justification

## Quick Reference

| Old Pattern | New Pattern | Rule |
|------------|-------------|------|
| `weight={500}` | `fw={500}` | 2.1 |
| `spacing="xs"` | `gap="xs"` | 2.2 |
| `position="apart"` | `justify="space-between"` | 2.3 |
| `mutation.isLoading` | `mutation.isPending` | 3.2 |
| `manga.id` (to API) | `toNumberId(manga.id)` | 1.1 |
| `value \|\| default` | `value ?? default` | 7.3 |
| `export { Type }` | `export type { Type }` | 5.1 |
