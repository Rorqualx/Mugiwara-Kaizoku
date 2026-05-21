# DOCUMENTATION_NAMING_CONVENTIONS

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DOCUMENTATION_NAMING_CONVENTIONS

---
# Documentation Naming Conventions

> **Status**: Approved  
> **Type**: Standards Document  
> **Last Updated**: January 2025  
> **Canonical**: Yes

## Overview

This document establishes naming conventions for all documentation in the Mugiwara-Kaizoku project. Consistent naming helps developers find documentation quickly and understand its purpose at a glance.

## General Principles

1. **Use descriptive names** - File names should clearly indicate content
2. **Be consistent** - Follow patterns established in this guide
3. **Use hyphens** - Separate words with hyphens, not underscores
4. **Lowercase preferred** - Use lowercase except for special files (README, CHANGELOG)
5. **No spaces** - Never use spaces in file names

## File Naming Patterns

### By Document Type

| Type | Pattern | Example |
|------|---------|---------|
| Feature Guide | `[feature-name]-guide.md` | `anilist-native-guide.md` |
| API Documentation | `[api-name]-api.md` | `manga-service-api.md` |
| Integration Guide | `[service]-integration.md` | `telegram-integration.md` |
| Pattern/Standard | `[pattern-name]-standardization.md` | `adapter-pattern-standardization.md` |
| Migration Guide | `[from]-to-[to]-migration.md` | `mangal-to-native-migration.md` |
| Architecture Doc | `[component]-architecture.md` | `type-system-architecture.md` |
| Configuration | `[feature]-configuration.md` | `auth-configuration.md` |
| Troubleshooting | `[feature]-troubleshooting.md` | `build-troubleshooting.md` |

### Special Files

These files use UPPERCASE and have specific meanings:

| File | Purpose |
|------|---------|
| `README.md` | Directory overview and index |
| `CHANGELOG.md` | Version history and changes |
| `CONTRIBUTING.md` | Contribution guidelines |
| `LICENSE.md` | License information |
| `CANONICAL_DOCS.md` | Authoritative documentation list |
| `TODO.md` | Task tracking (if needed) |

### Temporary/Working Documents

- Draft documents: `draft-[document-name].md`
- Work in progress: `wip-[document-name].md`
- Deprecated (before archiving): `deprecated-[document-name].md`

## Directory Structure

```
docs/
├── guides/                  # How-to guides
│   ├── getting-started.md
│   └── advanced-usage.md
├── reference/              # Technical reference
│   ├── api/               # API documentation
│   ├── architecture/      # Architecture docs
│   └── configuration/     # Config references
├── integrations/          # Third-party integrations
├── migrations/            # Migration guides
├── patterns/              # Design patterns
├── troubleshooting/       # Problem-solving guides
├── archive/               # Deprecated documentation
│   └── [year]/           # Archived by year
└── templates/             # Documentation templates
```

## Version Indicators

When documenting versioned features:

- Current version: `[feature]-guide.md`
- Specific version: `[feature]-v2-guide.md`
- Legacy version: `[feature]-legacy-guide.md`

## Language/Framework Specific

When documentation is specific to a language or framework:

- TypeScript specific: `[feature]-typescript.md`
- React specific: `[feature]-react.md`
- Node.js specific: `[feature]-node.md`

## Examples

### Good Names ✅

- `manga-status-standardization.md`
- `anilist-native-guide.md`
- `adapter-pattern-unified.md`
- `auth-to-authjs-migration.md`
- `build-system-troubleshooting.md`

### Bad Names ❌

- `manga status guide.md` (spaces)
- `AniList_Integration.md` (inconsistent case, underscores)
- `new-auth-docs-final-v2-FINAL.md` (redundant versioning)
- `adapter.md` (too generic)
- `fix-for-bug-123.md` (too specific, temporary)

## Component Documentation

For component-specific docs within the codebase:

```
src/
└── components/
    └── MangaReader/
        ├── README.md          # Component overview
        ├── MangaReader.tsx
        └── docs/
            ├── usage.md       # Usage examples
            └── props.md       # Props documentation
```

## Auto-generated Documentation

Auto-generated files should include a generation marker:

```
api-reference.generated.md
type-definitions.generated.md
```

## Metadata in File Names

Avoid including metadata in file names. Use frontmatter instead:

**Don't**: `auth-guide-draft-2024-01-john.md`

**Do**: `auth-guide.md` with frontmatter:
```markdown
---
status: draft
author: john
date: 2024-01-15
---
```

## Search Optimization

Consider how developers will search for documents:

1. **Include key terms** developers would search for
2. **Avoid abbreviations** unless widely known
3. **Use full product names** (e.g., "anilist" not "al")

## Migration from Old Names

When renaming documents:

1. Move old file to `archive/` with redirect notice
2. Create new file with proper name
3. Update all references
4. Add redirect in old location:

```markdown
# This document has moved

Please see [new-location.md](../path/to/new-location.md)
```

## Enforcement

1. **CI checks** will validate naming conventions
2. **PR reviews** should check for compliance
3. **Automated fixes** available via scripts

## Related Documentation

- [Documentation Templates](./templates/README.md)
- [Documentation Contribution Guide](./DOCUMENTATION_CONTRIBUTION_GUIDE.md)
- [CANONICAL_DOCS.md](./CANONICAL_DOCS.md)

---

**Questions?** These conventions can evolve - propose changes via PR with justification.
