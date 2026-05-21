# DOCUMENTATION_CONTRIBUTION_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DOCUMENTATION_CONTRIBUTION_GUIDE

---
# Documentation Contribution Guide

> **Status**: Approved  
> **Type**: Process Documentation  
> **Last Updated**: January 2025  
> **Canonical**: Yes

## Overview

This guide helps contributors create and maintain high-quality documentation for the Mugiwara-Kaizoku project. Good documentation is crucial for developer productivity and project success.

## Before You Start

### Check Existing Documentation

1. **Search first** - Check if documentation already exists
2. **Check CANONICAL_DOCS.md** - See the authoritative documentation list
3. **Check archive** - Ensure you're not recreating deprecated docs
4. **Ask in #documentation** - Confirm if documentation is needed

### Documentation Types

| Type | Purpose | Template |
|------|---------|----------|
| Guide | How to accomplish tasks | [FEATURE_TEMPLATE.md](./templates/FEATURE_TEMPLATE.md) |
| Reference | Technical specifications | [API_TEMPLATE.md](./templates/API_TEMPLATE.md) |
| Integration | External service setup | [INTEGRATION_TEMPLATE.md](./templates/INTEGRATION_TEMPLATE.md) |
| Migration | Upgrade instructions | [MIGRATION_TEMPLATE.md](./templates/MIGRATION_TEMPLATE.md) |

## Contributing Process

### 1. Planning

Before writing:
- [ ] Identify target audience
- [ ] Define scope and goals
- [ ] Check naming conventions
- [ ] Choose appropriate template

### 2. Writing

#### Use Our Standards

1. **Follow templates** - Start with our [templates](./templates/)
2. **Use naming conventions** - Follow [naming standards](./DOCUMENTATION_NAMING_CONVENTIONS.md)
3. **Include examples** - Every concept needs code examples
4. **Test everything** - All code must work

#### Writing Style

- **Be concise** - Get to the point quickly
- **Use active voice** - "Configure the server" not "The server should be configured"
- **Define terms** - Explain jargon and acronyms on first use
- **Show, don't just tell** - Include examples for every concept

#### Code Examples

```typescript
// ✅ Good: Complete, runnable example
import { MangaService } from '@/services/manga';

async function searchManga(query: string) {
  const service = new MangaService();
  const results = await service.search(query);
  return results;
}

// ❌ Bad: Incomplete, won't run
mangaService.search(query) // What is mangaService?
```

### 3. Review Process

#### Self-Review Checklist

- [ ] Documentation follows template structure
- [ ] All code examples tested and working
- [ ] Links to related docs included
- [ ] No spelling/grammar errors
- [ ] Metadata (author, date, status) updated
- [ ] File naming convention followed

#### Peer Review

1. **Create PR** with clear description
2. **Tag reviewers** - Include `documentation` label
3. **Address feedback** - Update based on reviews
4. **Update tracker** - Add to CANONICAL_DOCS.md if authoritative

### 4. Maintenance

Documentation requires ongoing maintenance:

- **Update for code changes** - Keep docs in sync
- **Monitor for accuracy** - Fix outdated information
- **Respond to feedback** - Address user questions
- **Archive when obsolete** - Move to archive/ directory

## Quality Standards

### Required Elements

Every document must include:

1. **Header metadata**
   ```markdown
   > **Status**: Draft | Review | Approved
   > **Author**: Your Name
   > **Last Updated**: 2025-01-15
   > **Canonical**: Yes/No
   ```

2. **Overview section** - What and why

3. **Usage examples** - How to use

4. **Related links** - Where to learn more

### Code Quality

- **TypeScript required** - Use TypeScript for all examples
- **Error handling** - Show how to handle errors
- **Real examples** - Use realistic scenarios
- **Complete imports** - Show all required imports

### Accessibility

- **Use headings hierarchy** - h1 → h2 → h3
- **Alt text for images** - Describe all images
- **Link context** - Don't use "click here"
- **Code highlighting** - Use language identifiers

## Common Pitfalls

### 1. Too Much or Too Little

**Too Much**: Don't document obvious things
```typescript
// ❌ Bad: Over-documenting
// This function adds two numbers together
// It takes two parameters: a and b
// It returns the sum of a and b
function add(a: number, b: number): number {
  return a + b;
}
```

**Too Little**: Do document complex logic
```typescript
// ✅ Good: Documenting complexity
/**
 * Calculates manga reading progress with weighted chapters.
 * Special chapters (0.5, 0.1) count as partial progress.
 * @param chapters - Array of chapter numbers read
 * @param totalChapters - Total chapters in series
 * @returns Progress percentage (0-100)
 */
function calculateProgress(chapters: number[], totalChapters: number): number {
  // Implementation
}
```

### 2. Outdated Examples

Always use current patterns:
```typescript
// ❌ Bad: Old pattern
import { OldAdapter } from '@/old/path';

// ✅ Good: Current pattern
import { Adapter } from '@/adapters';
```

### 3. Missing Context

Provide necessary context:
```typescript
// ❌ Bad: No context
const result = await processData(input);

// ✅ Good: With context
// Process manga metadata from AniList API
// Validates and transforms to our domain model
const mangaData = await processAniListResponse(anilistResponse);
```

## Tools and Resources

### Validation Tools

```bash
# Check documentation quality
npm run validate:docs

# Fix common issues
npm run fix:docs

# Check cross-references
npm run check:refs
```

### Helpful Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Code Example Best Practices](./code-examples-guide.md)

## Getting Help

- **Slack**: #documentation
- **Templates**: [docs/templates/](./templates/)
- **Examples**: Check existing docs in [CANONICAL_DOCS.md](./CANONICAL_DOCS.md)

## Recognition

We value documentation contributions! 

- Documentation PRs count toward contribution stats
- Significant docs improvements highlighted in release notes
- Documentation authors credited in file metadata

## Quick Start Checklist

Starting new documentation? Follow these steps:

1. [ ] Check if doc already exists
2. [ ] Copy appropriate template
3. [ ] Follow naming convention
4. [ ] Write content with examples
5. [ ] Test all code snippets
6. [ ] Run validation tools
7. [ ] Create PR with `documentation` label
8. [ ] Update CANONICAL_DOCS.md after approval

---

**Thank you for contributing to our documentation!** Good docs make everyone more productive. 📚
