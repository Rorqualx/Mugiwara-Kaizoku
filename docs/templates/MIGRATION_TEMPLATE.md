# Migration Guide: [Old Feature] to [New Feature]

> **Status**: [Draft | Review | Approved]  
> **Type**: Migration Guide  
> **Breaking Changes**: [Yes/No]  
> **Last Updated**: [Date]

## Overview

This guide helps you migrate from [old feature/pattern] to [new feature/pattern].

**Migration urgency**: [Low | Medium | High | Critical]  
**Estimated time**: [time estimate per component/file]  
**Deprecation date**: [when old pattern will be removed]

## Why Migrate?

[Explain the benefits and reasons for migration]

- ✅ Benefit 1
- ✅ Benefit 2
- ✅ Benefit 3

## Breaking Changes

[List all breaking changes]

1. **Change 1**: [Description]
2. **Change 2**: [Description]

## Migration Steps

### Step 1: Update Dependencies

```bash
# If package updates needed
npm install new-package@latest
npm uninstall old-package
```

### Step 2: Update Imports

#### Before
```typescript
import { OldComponent } from '@/old/path';
import { deprecatedFunction } from '@/utils/old';
```

#### After
```typescript
import { NewComponent } from '@/new/path';
import { newFunction } from '@/utils/new';
```

### Step 3: Update Usage Patterns

#### Pattern 1: [Description]

**Before:**
```typescript
// Old pattern
const result = oldFunction(param1, param2);
```

**After:**
```typescript
// New pattern
const result = newFunction({ param1, param2 });
```

#### Pattern 2: [Description]

**Before:**
```typescript
// Old component usage
<OldComponent prop1="value" prop2={data} />
```

**After:**
```typescript
// New component usage
<NewComponent 
  config={{ prop1: "value" }}
  data={data}
/>
```

### Step 4: Update Configuration

**Before:**
```typescript
// old.config.ts
export const config = {
  option1: true,
  option2: 'value'
};
```

**After:**
```typescript
// new.config.ts
export const config = {
  features: {
    option1: true,
  },
  settings: {
    option2: 'value'
  }
};
```

### Step 5: Update Tests

**Before:**
```typescript
describe('OldComponent', () => {
  it('test case', () => {
    // Old test
  });
});
```

**After:**
```typescript
describe('NewComponent', () => {
  it('test case', () => {
    // Updated test
  });
});
```

## Automated Migration

[If available, provide automated migration tools]

```bash
# Run migration script
npx migrate-to-new-pattern

# Or manual codemod
npx jscodeshift -t transforms/migrate-pattern.js src/
```

## Common Issues and Solutions

### Issue 1: Type Errors

**Error:**
```
Type 'OldType' is not assignable to type 'NewType'
```

**Solution:**
```typescript
// Update type definitions
type NewType = {
  // Updated structure
};
```

### Issue 2: Runtime Errors

**Error:**
```
Cannot read property 'x' of undefined
```

**Solution:**
[Explain the fix]

## Verification Checklist

After migration, verify:

- [ ] All imports updated
- [ ] No TypeScript errors
- [ ] Tests pass
- [ ] Application builds successfully
- [ ] Runtime behavior unchanged
- [ ] Performance acceptable
- [ ] No console warnings

## Rollback Plan

If issues arise:

1. **Immediate rollback**: `git revert [commit-hash]`
2. **Feature flag**: Toggle old behavior
3. **Gradual rollback**: Revert specific components

## Resources

- [New Feature Documentation]
- [API Changes Document]
- [Example Migration PR]
- [Video Tutorial]

## Support

- **Slack Channel**: #migration-help
- **Office Hours**: Tuesdays 2-3pm
- **Documentation**: [link]

## FAQ

**Q: Can I migrate gradually?**  
A: Yes, [explain approach]

**Q: What about backwards compatibility?**  
A: [Explain compatibility story]

**Q: How long will old pattern be supported?**  
A: Until [date], with deprecation warnings starting [date]

---

**Need help?** Post in #migration-help or check CANONICAL_DOCS.md
