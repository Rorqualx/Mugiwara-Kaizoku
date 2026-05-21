# DOCUMENTATION_BEST_PRACTICES

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DOCUMENTATION_BEST_PRACTICES

---
# Documentation Best Practices Guide

> Comprehensive guide for creating and maintaining high-quality documentation  
> Version: 1.0.0 | Last Updated: January 2025

## 📚 Table of Contents

1. [Core Principles](#core-principles)
2. [Writing Guidelines](#writing-guidelines)
3. [Technical Documentation](#technical-documentation)
4. [Code Examples](#code-examples)
5. [Common Patterns](#common-patterns)
6. [Anti-Patterns](#anti-patterns)
7. [Tools & Automation](#tools--automation)
8. [Quality Checklist](#quality-checklist)

## Core Principles

### 1. Clarity First
Documentation should be immediately understandable to your target audience.

✅ **Good**: "The AsyncResult pattern wraps async operations to handle both success and error cases consistently."

❌ **Bad**: "AsyncResult implements a monadic pattern for computational contexts with error propagation."

### 2. Show, Don't Just Tell
Always include examples alongside explanations.

```typescript
// ✅ Good: Clear example with explanation
/**
 * Fetches manga data with proper error handling
 * @returns AsyncResult with manga data or error message
 */
export async function fetchManga(id: string): AsyncResult<Manga> {
  try {
    const manga = await api.getManga(id);
    return { success: true, data: manga };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Usage example:
const result = await fetchManga('123');
if (result.success) {
  console.log('Manga title:', result.data.title);
} else {
  console.error('Failed to fetch:', result.error);
}
```

### 3. Keep It Current
Documentation must evolve with the code.

```yaml
# ✅ Good: Link docs to code
docs:
  manga-service.md:
    source: src/services/manga-service.ts
    auto-update: true
    last-sync: 2025-01-15
```

### 4. Progressive Disclosure
Start simple, add complexity gradually.

```markdown
## Quick Start
1. Install: `npm install @kaizoku/manga-reader`
2. Basic usage: `const manga = await getManga('123')`

## Advanced Usage
For production applications, use error handling...

## Expert Configuration
Custom timeout and retry configuration...
```

## Writing Guidelines

### Structure Every Document

```markdown
# Document Title

> Brief description of what this document covers  
> **Last Updated**: January 2025 | **Version**: 1.0.0

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Detailed Guide](#detailed-guide)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Related Documents](#related-documents)

## Overview
Brief introduction explaining the what and why.

## Quick Start
Minimal steps to get started immediately.

## Detailed Guide
Comprehensive information with examples.

## Examples
Real-world usage examples.

## Troubleshooting
Common issues and solutions.

## Related Documents
Links to related documentation.
```

### Writing Style

#### Use Active Voice
✅ **Good**: "The service validates input before processing."  
❌ **Bad**: "Input is validated by the service before being processed."

#### Be Concise
✅ **Good**: "Returns manga data or an error."  
❌ **Bad**: "This function will return either the manga data if successful, or it will return an error if something goes wrong."

#### Use Consistent Terminology
- **Manga**: Not "comic" or "book"
- **Chapter**: Not "episode" or "issue"
- **AsyncResult**: Not "Result" or "AsyncResponse"

#### Format for Readability
- Use headers to break up content
- Keep paragraphs short (3-4 sentences)
- Use bullet points for lists
- Add code blocks for examples

## Technical Documentation

### API Documentation Template

```typescript
/**
 * Fetches manga information from the specified source
 * 
 * @param id - Unique identifier for the manga
 * @param options - Optional configuration
 * @param options.includeChapters - Whether to include chapter list (default: false)
 * @param options.source - Specific source to use (default: primary source)
 * 
 * @returns Promise resolving to AsyncResult with manga data
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await getManga('manga123');
 * 
 * // With options
 * const result = await getManga('manga123', {
 *   includeChapters: true,
 *   source: 'anilist'
 * });
 * ```
 * 
 * @throws Never throws - errors are wrapped in AsyncResult
 * 
 * @since 1.0.0
 * @see {@link AsyncResult} for result structure
 * @see {@link MangaSource} for available sources
 */
export async function getManga(
  id: string, 
  options?: GetMangaOptions
): AsyncResult<Manga> {
  // Implementation
}
```

### Component Documentation

```tsx
/**
 * MangaCard displays manga information in a card layout
 * 
 * @component
 * @example
 * ```tsx
 * <MangaCard 
 *   manga={mangaData}
 *   onSelect={(manga) => console.log('Selected:', manga.title)}
 *   variant="compact"
 * />
 * ```
 */
export interface MangaCardProps {
  /** Manga data to display */
  manga: Manga;
  
  /** Callback when card is selected */
  onSelect?: (manga: Manga) => void;
  
  /** Visual variant of the card
   * @default 'standard'
   */
  variant?: 'standard' | 'compact' | 'detailed';
  
  /** Whether to show loading skeleton
   * @default false
   */
  loading?: boolean;
}
```

### Configuration Documentation

```typescript
/**
 * Kaizoku configuration options
 * 
 * @example
 * ```typescript
 * // config/kaizoku.config.ts
 * export default {
 *   sources: {
 *     primary: 'anilist',
 *     fallback: ['mangadex', 'mangasee']
 *   },
 *   cache: {
 *     enabled: true,
 *     ttl: 3600 // 1 hour
 *   }
 * } satisfies KaizokuConfig;
 * ```
 */
export interface KaizokuConfig {
  /** Source configuration */
  sources: {
    /** Primary source for manga data */
    primary: MangaSource;
    /** Fallback sources in priority order */
    fallback?: MangaSource[];
  };
  
  /** Cache configuration */
  cache?: {
    /** Enable caching */
    enabled: boolean;
    /** Cache TTL in seconds */
    ttl: number;
    /** Redis connection string */
    redis?: string;
  };
}
```

## Code Examples

### Example Quality Levels

#### Level 1: Basic Usage
```typescript
// Shows the simplest possible usage
const manga = await getManga('123');
```

#### Level 2: Real-World Usage
```typescript
// Shows error handling and common patterns
const result = await getManga('123');
if (!result.success) {
  logger.error('Failed to fetch manga:', result.error);
  return showError(result.error);
}

const { data: manga } = result;
displayManga(manga);
```

#### Level 3: Production-Ready
```typescript
// Shows complete implementation with all best practices
export async function displayMangaPage(mangaId: string): AsyncResult<void> {
  // Show loading state
  setLoading(true);
  
  try {
    // Fetch with timeout and retry
    const result = await withRetry(
      () => getManga(mangaId, { includeChapters: true }),
      { maxAttempts: 3, delay: 1000 }
    );
    
    if (!result.success) {
      // Log error with context
      logger.error('Manga fetch failed', {
        mangaId,
        error: result.error,
        timestamp: new Date().toISOString()
      });
      
      // Show user-friendly error
      showNotification({
        type: 'error',
        message: 'Unable to load manga. Please try again.',
        action: { label: 'Retry', onClick: () => displayMangaPage(mangaId) }
      });
      
      return { success: false, error: result.error };
    }
    
    // Update UI with data
    updateMangaDisplay(result.data);
    
    // Prefetch related data
    void prefetchRelatedManga(result.data.relatedIds);
    
    return { success: true, data: undefined };
    
  } finally {
    setLoading(false);
  }
}
```

## Common Patterns

### Documentation Update Pattern
When code changes, documentation must follow:

```bash
# 1. Update code
git checkout -b feature/update-manga-service

# 2. Update documentation immediately
code docs/services/manga-service.md

# 3. Validate documentation
npm run docs:validate:changed

# 4. Commit together
git add src/services/manga-service.ts docs/services/manga-service.md
git commit -m "feat: update manga service with caching

- Add Redis caching to manga service
- Update documentation with cache configuration
- Add examples for cache usage"
```

### Cross-Reference Pattern
Always link related documentation:

```markdown
## Related Documentation

- [AsyncResult Pattern](./patterns/async-result.md) - Error handling pattern
- [Manga Types](./types/manga-types.md) - Type definitions
- [API Reference](./api/manga-api.md) - Complete API documentation

## See Also

- [AniList Integration Guide](./integrations/anilist.md)
- [Caching Strategy](./architecture/caching.md)
- [Error Handling Best Practices](./guides/error-handling.md)
```

### Deprecation Pattern
When deprecating features:

```typescript
/**
 * @deprecated Since version 2.0.0. Use {@link getMangaById} instead.
 * This function will be removed in version 3.0.0.
 * 
 * @example
 * ```typescript
 * // Old way (deprecated)
 * const manga = await fetchManga('123');
 * 
 * // New way
 * const result = await getMangaById('123');
 * if (result.success) {
 *   const manga = result.data;
 * }
 * ```
 */
export async function fetchManga(id: string): Promise<Manga> {
  console.warn('fetchManga is deprecated. Use getMangaById instead.');
  const result = await getMangaById(id);
  if (!result.success) throw new Error(result.error);
  return result.data;
}
```

## Anti-Patterns

### 1. Documentation by Osmosis
❌ **Bad**: "For details, see the code."

✅ **Good**: Explain the concept, then reference code for implementation details.

### 2. Outdated Examples
❌ **Bad**: Examples that don't compile or use old APIs.

✅ **Good**: Test all examples in CI/CD:
```yaml
- name: Test Documentation Examples
  run: npm run docs:test:examples
```

### 3. Wall of Text
❌ **Bad**: Long paragraphs without structure.

✅ **Good**: Use headers, bullets, and short paragraphs.

### 4. Assuming Knowledge
❌ **Bad**: "Obviously, you'll need to configure the DI container."

✅ **Good**: "First, configure dependency injection (see [DI Guide](./di-guide.md))."

### 5. No Migration Path
❌ **Bad**: Change API without guidance.

✅ **Good**: Always provide migration guide:
```markdown
## Migration from v1 to v2

### Breaking Changes
1. `fetchManga` is now `getMangaById`
2. Return type changed from `Promise<Manga>` to `AsyncResult<Manga>`

### Migration Steps
1. Update imports:
   ```diff
   - import { fetchManga } from '@kaizoku/api';
   + import { getMangaById } from '@kaizoku/api';
   ```

2. Update usage:
   ```diff
   - const manga = await fetchManga('123');
   + const result = await getMangaById('123');
   + if (!result.success) {
   +   // Handle error
   + }
   + const manga = result.data;
   ```
```

## Tools & Automation

### Pre-commit Hooks
```yaml
# .husky/pre-commit
#!/bin/sh
# Validate documentation on commit
npm run docs:validate:changed
npm run docs:spell:changed
npm run docs:links:check
```

### Documentation Generation
```typescript
// scripts/generate-api-docs.ts
import { generateDocsFromTypes } from './utils';

// Auto-generate from TypeScript
generateDocsFromTypes({
  input: 'src/**/*.ts',
  output: 'docs/api',
  template: 'api-template.md'
});
```

### Continuous Validation
```yaml
# .github/workflows/docs.yml
name: Documentation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run docs:validate
      - run: npm run docs:test:examples
      - run: npm run docs:check:versions
```

## Quality Checklist

### Before Committing

- [ ] **Accuracy**: Information is correct and tested
- [ ] **Completeness**: All sections filled, no TODOs
- [ ] **Examples**: Working code examples included
- [ ] **Links**: All links validated and working
- [ ] **Formatting**: Proper markdown, consistent style
- [ ] **Spelling**: No typos (run spell check)
- [ ] **Versions**: Version numbers updated
- [ ] **References**: Cross-references valid

### Review Checklist

- [ ] **Technical Review**: Code examples work
- [ ] **Editorial Review**: Clear, concise writing
- [ ] **Consistency Review**: Matches project standards
- [ ] **Accessibility Review**: Readable, well-structured
- [ ] **Update Review**: Related docs updated

### Quality Metrics

Track these metrics monthly:

1. **Documentation Coverage**
   ```bash
   npm run docs:coverage
   # Target: >90% of public APIs documented
   ```

2. **Example Validity**
   ```bash
   npm run docs:test:examples
   # Target: 100% passing
   ```

3. **Link Health**
   ```bash
   npm run docs:links:check
   # Target: <5 broken links
   ```

4. **Freshness**
   ```bash
   npm run docs:freshness
   # Target: >80% updated in last 30 days
   ```

## Continuous Improvement

### Feedback Loop
1. Collect user feedback via surveys
2. Track documentation-related issues
3. Monitor search queries
4. Analyze page analytics

### Regular Reviews
- **Weekly**: Fix urgent issues
- **Monthly**: Update outdated content
- **Quarterly**: Comprehensive review
- **Yearly**: Major restructuring

### Innovation
- Experiment with new formats (videos, interactive demos)
- Implement AI-powered search
- Create documentation bots
- Build interactive playgrounds

---

**Remember**: Great documentation is an investment that pays dividends in reduced support burden, faster onboarding, and happier developers.

## Resources

- [Documentation Templates](./templates/README.md)
- [Style Guide](./DOCUMENTATION_STYLE_GUIDE.md)
- [Governance](./DOCUMENTATION_GOVERNANCE.md)
- [Contribution Guide](./DOCUMENTATION_CONTRIBUTION_GUIDE.md)

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Next Review**: April 2025