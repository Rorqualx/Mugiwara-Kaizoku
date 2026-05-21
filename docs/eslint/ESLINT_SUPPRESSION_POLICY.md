# ESLint Suppression Policy

**Status:** 🟢 ACTIVE POLICY
**Created:** 2025-11-09
**Last Updated:** 2025-11-09
**Strictness Level:** STRICT - Only legitimate patterns allowed

---

## Overview

This document defines **when and how** ESLint rule suppressions are allowed in the Mugiwara-Kaizoku codebase. Per project requirements:

> **"Only true legit patterns should be excluded"**

This means:
- ❌ No suppressions for convenience
- ❌ No suppressions to avoid fixing code
- ✅ Only suppressions for genuine external library issues
- ✅ All suppressions must be documented with justification

---

## General Policy

### NEVER Suppress These

**Absolutely forbidden suppressions** (must always fix the code):

```typescript
// ❌ FORBIDDEN - Lazy/convenience suppressions
/* eslint-disable */
// @ts-nocheck
// @ts-ignore

// ❌ FORBIDDEN - Blanket rule disabling
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// ... lots of code ...

// ❌ FORBIDDEN - No justification
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const data = response.data;
```

### Allowed Suppressions

**Only permitted in these specific cases:**

1. **External library bugs** - Library has incorrect/incomplete types
2. **External library limitations** - Library doesn't export proper types
3. **Platform limitations** - Node.js/browser API type gaps
4. **Temporary for WIP** - Code depends on not-yet-implemented features (must have TODO)

---

## Rule-Specific Policies

### @typescript-eslint/no-unsafe-assignment

**General Rule:** **NEVER suppress**. Fix the code.

**Legitimate Exception Cases:**

#### Exception 1: External Library Type Bug

**Allowed when:**
- External library has provably incorrect types
- No type definition fix available
- Reported to library maintainers

**Example:**
```typescript
// ✅ ALLOWED - react-window types incomplete (known issue #1234)
/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
// Reason: react-window v1.8.6 exports FixedSizeList without proper types
// Issue: https://github.com/bvaughn/react-window/issues/1234
// TODO: Remove when react-window v2.0 is released with fixed types
import { FixedSizeList } from 'react-window';
const List = FixedSizeList as ListComponent;
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

**Required elements:**
- `eslint-disable-next-line` (or block with enable)
- Comment with "Reason:" explaining the library issue
- Link to issue/docs proving the problem
- TODO with removal condition

#### Exception 2: Incomplete Prisma Schema (Temporary)

**Allowed ONLY during migration:**
- Code depends on Prisma model not yet added
- Model addition is planned and documented
- Suppression will be removed when model is added

**Example:**
```typescript
// ✅ ALLOWED TEMPORARILY - During Prisma migration only
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Reason: PackDownload model not yet added to schema.prisma
// TODO: Remove when PRISMA_MODELS_ADDITION_GUIDE.md Phase 1 is complete
// Tracked in: docs/eslint/NO_UNSAFE_ASSIGNMENT_SYSTEMATIC_PLAN.md
const prismaClientAny = this.prismaClient as unknown;
const packDownload = prismaClientAny['packDownload'];
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

**This is TEMPORARY and must be removed once models are added.**

---

### @typescript-eslint/no-unsafe-member-access

**General Rule:** **NEVER suppress**. Use type guards.

**Legitimate Exception Cases:**

#### Exception: Axios Interceptor Types

**Allowed when:**
- Axios interceptor types incomplete
- No way to properly type the config object

**Example:**
```typescript
/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
// Reason: Axios AxiosRequestConfig type doesn't include custom properties
// Reference: https://github.com/axios/axios/issues/1510
axiosInstance.interceptors.request.use((config) => {
  config.customProp = value; // Axios allows this but types don't
  return config;
});
```

---

### @typescript-eslint/no-unsafe-call

**General Rule:** **NEVER suppress**. Type the function properly.

**Legitimate Exception Cases:**

#### Exception: Dynamic Method Invocation (Very Rare)

**Allowed when:**
- Genuinely need to call dynamically determined method
- All alternatives exhausted
- Full validation performed

**Example:**
```typescript
// ✅ ALLOWED - After exhausting alternatives
/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
// Reason: Plugin system requires dynamic method invocation
// Validation: Method existence checked, args validated
// Alternative considered: Type map (rejected due to 100+ plugin methods)
if (typeof plugin[methodName] === 'function') {
  const result = plugin[methodName](validatedArgs);
}
```

---

### @typescript-eslint/no-explicit-any

**General Rule:** **ABSOLUTELY NEVER suppress**. Use `unknown` instead.

**Legitimate Exception Cases:**

#### Exception: NONE

There is **no legitimate reason** to use `any` type.

**Instead:**
```typescript
// ❌ WRONG
const data: any = fetchData();

// ✅ CORRECT
const data: unknown = fetchData();
if (isExpectedType(data)) {
  // data is now typed
}
```

---

### @typescript-eslint/no-unsafe-return

**General Rule:** **NEVER suppress**. Add return type and validation.

**Legitimate Exception Cases:**

#### Exception: Generic Utility Function (Rare)

**Allowed when:**
- Creating truly generic utility (not business logic)
- Caller responsible for type safety
- Documented in JSDoc

**Example:**
```typescript
/**
 * Generic deep clone utility
 * @warning Caller must validate returned type
 */
/* eslint-disable-next-line @typescript-eslint/no-unsafe-return */
// Reason: Generic utility for any data structure
// Caller responsibility: Validate returned value with type guard
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

---

## Test File Policy

### General Rule for Tests

**Tests follow SAME strictness as production code.**

Per requirements:
> **"Tests should be the same strictness"**

This means:
- ❌ No `any` types in tests
- ❌ No unsafe assignments in tests
- ✅ Use proper types for mocks
- ✅ Type test data properly

### Test-Specific Guidelines

#### Mock Data

```typescript
// ❌ WRONG - Using any
const mockData = { id: 1, name: 'test' } as any;

// ✅ CORRECT - Proper typing
import type { Manga } from '@prisma/client';

const mockManga: Manga = {
  id: 1,
  title: 'Test Manga',
  slug: 'test-manga',
  // ... all required fields
};
```

#### External Library Mocks

```typescript
// ❌ WRONG - Lazy any
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} as any })
}));

// ✅ CORRECT - Typed mock
import type { AxiosResponse } from 'axios';

interface ApiResponse {
  status: string;
  data: unknown;
}

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: { status: 'ok', data: [] },
    status: 200,
    statusText: 'OK',
  } as AxiosResponse<ApiResponse>)
}));
```

#### Test Utilities

**Exception for generic test utilities only:**

```typescript
// ✅ ALLOWED ONLY in test utilities
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Reason: Generic test data factory for multiple types
// Usage: Tests must cast to specific type after generation
export function createMockData<T>(overrides: Partial<T>): T {
  return { ...defaultTestData, ...overrides } as T;
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

**Must be:**
- In dedicated test utility file
- Clearly documented as generic
- Used with proper typing by callers

---

## Suppression Format

### Required Format

All suppressions **must follow this format:**

```typescript
/* eslint-disable-next-line <rule-name> */
// Reason: <specific explanation of why needed>
// Reference: <link to issue/docs/spec>
// TODO: <removal condition> | OR: Alternative: <why alternatives don't work>
<code with suppression>
```

### Block Suppressions

For multiple lines:

```typescript
/* eslint-disable <rule-name> */
// Reason: <explanation>
// Reference: <link>
// TODO: <removal condition>

<multiple lines of code>

/* eslint-enable <rule-name> */
```

**Never omit the `eslint-enable`** - Keeps suppression scoped.

---

## Review Checklist

Before approving a suppression, verify:

### Required Checks

- [ ] Is this truly necessary? (All alternatives exhausted?)
- [ ] Is there a specific, legitimate reason?
- [ ] Is the reason documented in comments?
- [ ] Is there a reference link (issue, docs, spec)?
- [ ] Is there a TODO with removal condition OR explanation of alternatives?
- [ ] Is the suppression scoped minimally (single line or small block)?
- [ ] Is there an `eslint-enable` if using block suppression?

### Red Flags (REJECT)

- ⛔ "Suppressing because it's too hard to fix"
- ⛔ "Suppressing for now, will fix later" (without TODO/tracking)
- ⛔ Large block suppressions (>10 lines)
- ⛔ No explanation comment
- ⛔ Using `eslint-disable` without `eslint-enable`
- ⛔ Blanket `@ts-nocheck` or `eslint-disable` for whole file

---

## Examples: ALLOWED vs FORBIDDEN

### ❌ FORBIDDEN Example 1

```typescript
// ❌ No explanation, no tracking
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const data = response.data;
```

**Why:** No justification. Should use Zod validation instead.

---

### ❌ FORBIDDEN Example 2

```typescript
// ❌ Blanket suppression for convenience
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

function processData(input: unknown) {
  const data = input as any;
  const result = data.items.map((item: any) => item.value);
  return result;
}
```

**Why:** Lazy coding. Should use proper types and guards.

---

### ❌ FORBIDDEN Example 3

```typescript
// @ts-nocheck
// ❌ Entire file ignored

// lots of code with type errors...
```

**Why:** Nuclear option. Fix the code instead.

---

### ✅ ALLOWED Example 1

```typescript
/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
// Reason: Cheerio v1.0.0-rc.12 Element type incomplete for this.attribs
// Reference: https://github.com/cheeriojs/cheerio/issues/2890
// TODO: Remove when cheerio v2.0 releases with fixed types (Q1 2026)
const attribs = $(element)[0].attribs;
```

**Why:** Legitimate external library issue, fully documented, has removal condition.

---

### ✅ ALLOWED Example 2

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Reason: PackDownload model not in schema.prisma yet
// Reference: docs/eslint/PRISMA_MODELS_ADDITION_GUIDE.md Phase 1
// TODO: Remove when PackDownload model added (tracked in Phase 1)
const prismaClientAny = this.prismaClient as unknown;
if (isObject(prismaClientAny) && hasProperty(prismaClientAny, 'packDownload')) {
  const packDownload = prismaClientAny['packDownload'];
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

**Why:** Temporary during Prisma migration, with clear tracking and removal plan.

---

## Enforcement

### Pre-commit Hook

The pre-commit hook should:

1. **Check suppression format**
   - All suppressions have comments
   - Comments include "Reason:" and "TODO:" or "Reference:"

2. **Count suppressions**
   - Fail if suppressions increase without approval
   - Track in `.eslint-suppressions-count`

3. **Flag blanket suppressions**
   - Fail on `@ts-nocheck` (except temporary Prisma migration)
   - Fail on `eslint-disable` without `eslint-enable`

### Code Review

Reviewers **must** verify:
- Is suppression justified?
- Are alternatives truly exhausted?
- Is tracking/removal plan clear?

**Default stance:** REJECT suppression, request code fix instead.

---

## Exceptions Process

### Requesting an Exception

If you believe you need a suppression not covered by this policy:

1. **Document the case**
   - Why is it needed?
   - What alternatives were tried?
   - Why didn't alternatives work?

2. **Propose policy update**
   - Add to this document
   - Get team review/approval

3. **Update policy FIRST**
   - Don't add suppression until policy updated
   - Policy change requires consensus

---

## Statistics & Tracking

### Current Baselines (2025-11-09)

| Rule | Baseline Violations | Target | Current Suppressions |
|------|---------------------|--------|---------------------|
| no-unsafe-assignment | ~1,346 | 0 | TBD after audit |
| no-unsafe-member-access | ~3,222 | 0 | TBD after audit |
| no-explicit-any | Unknown | 0 | TBD after audit |
| no-unsafe-call | Unknown | 0 | TBD after audit |
| no-unsafe-return | Unknown | 0 | TBD after audit |

### Monitoring

Track suppressions in each PR:
```bash
# Count suppressions
git diff main | grep -c "eslint-disable"

# Must not increase without justification
```

---

## Related Documents

- [NO_UNSAFE_ASSIGNMENT_SYSTEMATIC_PLAN.md](./NO_UNSAFE_ASSIGNMENT_SYSTEMATIC_PLAN.md) - Remediation strategy
- [PRISMA_MODELS_ADDITION_GUIDE.md](./PRISMA_MODELS_ADDITION_GUIDE.md) - Temporary suppression context
- [ZOD_SCHEMAS_TEMPLATE.md](./ZOD_SCHEMAS_TEMPLATE.md) - How to properly validate instead of suppressing
- [CLAUDE.md](../../CLAUDE.md) - General project rules

---

## Document Metadata

**Version:** 1.0
**Status:** Active Policy
**Authority:** Project Standards
**Review Cycle:** After each phase of no-unsafe-assignment remediation
**Last Review:** 2025-11-09

---

## Summary: When to Suppress

### Quick Decision Tree

```
Need to suppress ESLint rule?
├─ Is it external library bug? ──> YES ──> Document + link to issue ──> ALLOWED
├─ Is it temporary Prisma migration? ──> YES ──> Document + TODO ──> ALLOWED (temp)
├─ Is it test code? ──> YES ──> Can you fix it? ──> YES ──> FIX IT
│                                                  └─> NO ──> FORBIDDEN
└─ All other cases? ──> FIX THE CODE, DON'T SUPPRESS
```

**Default answer: FIX THE CODE** ✅

