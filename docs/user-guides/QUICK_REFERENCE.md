# QUICK_REFERENCE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for QUICK_REFERENCE

---
# 🚀 Mugiwara-Kaizoku Quick Reference Card

## 🔴 Common Errors & Quick Fixes

### ID Type Conversions
```typescript
// ❌ WRONG
{ mangaId: manga.id }

// ✅ CORRECT
import { toNumberId } from '@/utils/id-converters';
{ mangaId: toNumberId(manga.id) }
```

### Mantine v7 Props
```typescript
// ❌ OLD → ✅ NEW
<Text weight={500}>       → <Text fw={500}>
<Group spacing="xs">      → <Group gap="xs">
<Stack spacing="md">      → <Stack gap="md">
<Group position="apart">  → <Group justify="space-between">
<Group position="center"> → <Group justify="center">
<Progress animate>        → <Progress animated>
<MultiSelect creatable>   → // Remove creatable, use custom solution
```

### tRPC v10 Syntax
```typescript
// ❌ OLD → ✅ NEW
trpc.settings.query.useQuery()     → trpc.settings.getAll.useQuery()
mutation.isLoading                 → mutation.isPending
query.isLoading                    → query.isPending
```

### Imports
```typescript
// ❌ WRONG
import { trpc } from '@/utils/trpc-client';

// ✅ CORRECT
import { trpc } from '../utils/trpc-client/index';
```

### Type-Only Exports
```typescript
// ❌ WRONG
export { HttpClient } from './client';

// ✅ CORRECT
export type { HttpClient } from './client';
export { createHttpClient } from './client';
```

### Null Safety
```typescript
// ❌ WRONG
manga.source.toLowerCase()
config.value || 100

// ✅ CORRECT
manga.source?.toLowerCase()
config.value ?? 100
```

### AsyncResult Pattern
```typescript
// ✅ CORRECT USAGE
if (isSuccess(result)) {
  // use result.data
} else if (isError(result)) {
  // handle result.error
} else if (isLoading(result)) {
  // show loading
}

// Error creation
return createErrorResult(
  error instanceof Error ? error : new Error(String(error))
);
```

### Array Type Guards
```typescript
// ❌ WRONG
const items = data.map(item => item.name);

// ✅ CORRECT
if (!Array.isArray(data)) {
  return [];
}
const items = data.map(item => item?.name);
```

### Parameter Types
```typescript
// ❌ WRONG
onChange={(value) => setValue(value)}
filter(item => item.active)

// ✅ CORRECT
onChange={(value: string) => setValue(value)}
filter((item: ItemType) => item.active)
```

### Tabler Icons (v3.34.0)
```typescript
// ❌ OLD → ✅ NEW
IconFolderOpened → IconFolderOpen
IconBrandAnilist → // Not available, use alternative
IconSparkles → IconStar
IconBrain → IconCpu
```

## 📋 Pre-Commit Checklist

- [ ] Run `pnpm type-check` - MUST PASS
- [ ] All IDs converted with `toNumberId()`
- [ ] No Mantine v6 props (weight, spacing, position)
- [ ] No `mutation.isLoading` (use `isPending`)
- [ ] No `any` types without justification
- [ ] All imports use relative paths
- [ ] Null checks with `?.` where needed
- [ ] Default values use `??` not `||`

## 🛠️ Essential Commands

```bash
# Check types
pnpm type-check

# Build (ONLY approved command)
pnpm build:clean

# Fix common issues
pnpm lint --fix

# Check before commit
pnpm validate
```

## 🎯 Type Utilities

```typescript
// ID Converters
import { toNumberId, toStringId, convertIdArray } from '@/utils/id-converters';

// Type Guards
import { isSuccess, isError, isLoading } from '@/utils/async-result';
import { isValidId, isNonNullable, isError as isErrorInstance } from '@/utils/type-guards';
```

## ⚠️ Prisma Models
Before using any Prisma model, verify it exists:
```bash
# Check schema
cat prisma/schema.prisma | grep "model ModelName"

# Generate client
npx prisma generate
```

## 🚫 Never Do This
1. Create `.fixed.ts` files
2. Use `any` without type guards
3. Cast Prisma enums to strings
4. Import from `@/` aliases
5. Use `||` for defaults (use `??`)
6. Skip type checking before commit

---
**Remember**: When in doubt, check `/docs/DEVELOPMENT_RULES.md`
