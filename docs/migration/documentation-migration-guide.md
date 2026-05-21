# Documentation Migration Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Documentation Migration Guide

---
# Documentation Migration Guide

> 🔄 **Purpose**: Help developers transition from deprecated documentation to canonical sources
>
> Last Updated: January 2025

## Quick Reference: What to Use Instead

### If You're Looking At...

| Deprecated Document | Use This Instead | Key Changes |
|-------------------|-----------------|------------|
| `adapter-implementation-guide.md` | [adapter-pattern-unified.md](../adapter-pattern-unified.md) | Dual-method pattern (AsyncResult + throws) |
| `adapter-implementation-patterns.md` | [adapter-pattern-unified.md](../adapter-pattern-unified.md) | Standardized approach |
| `adapter-interfaces.md` | [adapter-pattern-unified.md](../adapter-pattern-unified.md) | Updated interfaces |
| `anilist-integration.md` | [anilist-native-guide.md](../anilist-native-guide.md) | No mangal CLI references |
| `anilist-adapter-implementation.md` | [anilist-native-guide.md](../anilist-native-guide.md) | Native GraphQL only |
| `auth-system.md` | [authentication-standardization.md](../authentication-standardization.md) | NextAuth.js, not Lucia |
| `production-auth-setup.md` | [authentication-standardization.md](../authentication-standardization.md) | Correct auth system |
| `testing-patterns-guide.md` | [testing-guide-unified.md](../../../testing-guide-unified.md) | Consolidated approach |
| `test-patterns.md` | [testing-guide-unified.md](../../../testing-guide-unified.md) | Single source of truth |

## Why Documents Were Deprecated

### 1. Conflicting Information
Many documents were created during different phases of development and contain contradictory information:
- Different adapter implementation patterns
- Inconsistent enum definitions
- Mixed authentication systems

### 2. Outdated Architecture
Some documents describe architectures that were never implemented or have been replaced:
- Mangal CLI integration for AniList (never implemented)
- Lucia Auth (project uses NextAuth.js)
- Proposed directory structures that don't exist

### 3. Redundancy
Multiple documents covered the same topics with slight variations, causing confusion:
- 4+ different testing guides
- 3+ adapter pattern documents
- Multiple authentication guides

## How to Migrate Your Understanding

### Step 1: Identify What You Need

Ask yourself:
- What specific information am I looking for?
- Which part of the system am I working on?
- Am I implementing new code or maintaining existing code?

### Step 2: Check the Canonical Docs List

Always start with [CANONICAL_DOCS.md](../CANONICAL_DOCS.md) which provides:
- Quick reference decision tree
- Authoritative document for each topic
- Critical warnings about common mistakes

### Step 3: Use the Standardization Guides

For the most common issues, dedicated standardization guides exist:

#### For Enum/Status Issues
→ [manga-status-standardization-final.md](../manga-status-standardization-final.md)
- Always use UPPERCASE values
- Use mapping functions for external data
- Clear examples of correct usage

#### For Adapter Implementation
→ [adapter-pattern-unified.md](../adapter-pattern-unified.md)
- Dual-method pattern explained
- Complete implementation template
- Error handling standards

#### For Integration Confusion
→ [anilist-native-guide.md](../anilist-native-guide.md)
- Clarifies native vs mangal integration
- GraphQL query examples
- No CLI references

#### For Testing Approach
→ [testing-guide-unified.md](../../../testing-guide-unified.md)
- Single comprehensive guide
- Best practices consolidated
- Common patterns explained

## Common Migration Scenarios

### Scenario 1: "I was following the adapter guide and now my code doesn't match"

**Old approach** (from deprecated guides):
```typescript
class MyAdapter {
  async search(query: string): Promise<Results[]> {
    return await api.search(query);
  }
}
```

**New approach** (from canonical guide):
```typescript
class MyAdapter {
  private async searchInternal(query: string): Promise<AsyncResult<Results[]>> {
    // Returns AsyncResult
  }
  
  async search(query: string): Promise<Results[]> {
    // Throws on error for compatibility
  }
}
```

**Migration**: Add internal methods gradually while keeping public API stable.

### Scenario 2: "The auth documentation I was using mentions Lucia"

**You were reading**: Deprecated auth documentation
**Truth**: This project uses NextAuth.js/Auth.js

**Migration**: 
1. Ignore all Lucia references
2. Read [authentication-standardization.md](../authentication-standardization.md)
3. Use NextAuth.js patterns and APIs

### Scenario 3: "I can't find the /types/dto directory mentioned in docs"

**You were reading**: Proposed architecture that was never implemented
**Truth**: Use actual directory structure

**Migration**:
```
Documented (wrong) → Actual (correct)
/types/dto/        → /types/domain/
/types/utils/      → /utils/
/types/api/        → /types/shared/
```

## Validation Tools

Check if you're using deprecated patterns:

```bash
# Validate your documentation references
node scripts/validation/validate-documentation.js

# Check for outdated cross-references
node scripts/validation/validate-cross-references.js

# Update references automatically
node scripts/validation/validate-cross-references.js --update
```

## Red Flags in Documentation

If you see these in documentation, it's likely deprecated:

1. **Lowercase enum values**: `MangaStatus.ongoing` ❌
2. **Mangal CLI for metadata**: Any mention of using mangal for AniList ❌
3. **Lucia Auth**: Any authentication using Lucia ❌
4. **Promise-only adapters**: Adapters without AsyncResult pattern ❌
5. **Non-existent paths**: `/types/dto/`, `/types/utils/` ❌

## Getting Unstuck

### If you're confused:
1. Check [CANONICAL_DOCS.md](../CANONICAL_DOCS.md) first
2. Look for a standardization guide on your topic
3. Search for working examples in the codebase
4. Run validation scripts to identify issues

### If documentation conflicts:
1. Canonical docs always win
2. Newer standardization guides override older docs
3. Check the "Last Updated" date
4. When in doubt, check what the code actually does

### If you find issues:
1. Don't update deprecated docs (they're deprecated!)
2. Update canonical documentation instead
3. Add warnings to deprecated docs if needed
4. Report conflicting information

## Best Practices Going Forward

1. **Always verify documentation** against actual code
2. **Check dates** - newer usually means more accurate
3. **Use canonical docs** as your primary reference
4. **Report conflicts** when you find them
5. **Don't create new docs** without checking for existing ones

## Cheat Sheet: Quick Answers

**Q: What MangaStatus values should I use?**
A: UPPERCASE only (ONGOING, COMPLETED, etc.)

**Q: How do I integrate with AniList?**
A: Native GraphQL only, no mangal CLI

**Q: What auth system do we use?**
A: NextAuth.js/Auth.js (not Lucia)

**Q: Where do types go?**
A: domain/, adapters/, shared/ (not dto/ or api/)

**Q: How should adapters work?**
A: Dual-method pattern with AsyncResult

**Q: Which testing guide?**
A: [testing-guide-unified.md](../../../testing-guide-unified.md) only

---

## Need More Help?

1. The [pattern-migration-guide.md](./pattern-migration-guide.md) has code examples
2. The validation scripts can identify specific issues
3. Search the codebase for working examples
4. Check the CHANGELOG for migration notes

Remember: The goal is consistency. When everyone uses the same patterns and documentation, development is faster and less error-prone.
