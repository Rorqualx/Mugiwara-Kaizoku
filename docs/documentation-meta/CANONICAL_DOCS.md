# CANONICAL_DOCS

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for CANONICAL_DOCS

---
# Canonical Documentation List

> ⚠️ **IMPORTANT**: PRISMA TYPES ARE NOW THE SINGLE SOURCE OF TRUTH
> 
> **UPDATE (January 2025)**: The canonical type system is being deprecated. 
> All types should now reference Prisma-generated types directly from `@prisma/client`.
> Do not use canonical types, compatibility layers, or type converters.
> 
> Last Updated: January 2025

## Overview

Due to extensive documentation created over 80+ phases of development, many documents contain conflicting or outdated information. This list identifies which documents should be considered **canonical** (authoritative) for each topic.

### ⚠️ CRITICAL CHANGE: Prisma Types Are Authoritative

**EFFECTIVE IMMEDIATELY**:
- Use `@prisma/client` types directly - no wrappers or converters
- All enums must match Prisma's UPPERCASE format exactly
- Remove all compatibility layers and type migration utilities
- Components must work directly with Prisma type shapes
- No duplicate type definitions - import from Prisma only

## ⚠️ Critical Warnings

### MangaStatus Enum
**USE UPPERCASE VALUES** - The canonical MangaStatus enum uses UPPERCASE string values:
```typescript
// ✅ CORRECT
MangaStatus.ONGOING  // "ONGOING"
MangaStatus.COMPLETED // "COMPLETED"

// ❌ WRONG - Will cause type errors
MangaStatus.ongoing  // lowercase
```

## Standardization Documents (USE THESE FIRST)

These documents resolve critical conflicts and should be your primary reference:

- **[manga-status-standardization-final.md](./manga-status-standardization-final.md)** - ✅ Authoritative MangaStatus enum guide
- **[anilist-native-guide.md](./anilist-native-guide.md)** - ✅ Correct AniList integration approach
- **[adapter-pattern-unified.md](./adapter-pattern-unified.md)** - ✅ Standard adapter implementation pattern
- **[integration-adapter-pattern.md](./integration-adapter-pattern.md)** - ✅ Integration-specific adapter patterns
- **[async-result-standardization.md](./async-result-standardization.md)** - ✅ Standard AsyncResult pattern (4 states)
- **[testing-guide-unified.md](./../../testing-guide-unified.md)** - ✅ Consolidated testing approach
- **[type-system-architecture-standardization.md](./type-system-architecture-standardization.md)** - ✅ Actual type system structure
- **[authentication-standardization.md](./authentication-standardization.md)** - ✅ Correct auth system (NextAuth.js)
- **[build-system-standardization.md](./build-system-standardization.md)** - ✅ Both build approaches explained
- **[component-pattern-unified.md](./component-pattern-unified.md)** - ✅ Unified React component patterns
- **[api-documentation-standardized.md](./api-documentation-standardized.md)** - ✅ Unified API development guide
- **[error-handling-standardized.md](./error-handling-standardized.md)** - ✅ Comprehensive error handling patterns

## Documentation Governance

These documents establish standards and processes for documentation:

- **[DOCUMENTATION_NAMING_CONVENTIONS.md](./DOCUMENTATION_NAMING_CONVENTIONS.md)** - ✅ File naming standards
- **[DOCUMENTATION_CONTRIBUTION_GUIDE.md](./DOCUMENTATION_CONTRIBUTION_GUIDE.md)** - ✅ How to contribute documentation
- **[templates/README.md](./templates/README.md)** - ✅ Documentation templates overview
- **[DOCUMENTATION_PROCEDURES_TEST_PLAN.md](./DOCUMENTATION_PROCEDURES_TEST_PLAN.md)** - ✅ Testing documentation procedures

### Documentation Templates

Standard templates for consistent documentation:

- **[templates/FEATURE_TEMPLATE.md](./templates/FEATURE_TEMPLATE.md)** - Template for feature documentation
- **[templates/API_TEMPLATE.md](./templates/API_TEMPLATE.md)** - Template for API documentation
- **[templates/INTEGRATION_TEMPLATE.md](./templates/INTEGRATION_TEMPLATE.md)** - Template for integration guides
- **[templates/MIGRATION_TEMPLATE.md](./templates/MIGRATION_TEMPLATE.md)** - Template for migration guides

## Migration Guides

These guides help you transition from deprecated patterns to current standards:

- **[migration/pattern-migration-guide.md](./migration/pattern-migration-guide.md)** - ✅ Step-by-step code migration instructions
- **[migration/documentation-migration-guide.md](./migration/documentation-migration-guide.md)** - ✅ How to find correct documentation

## Core Documentation

### Architecture & System Design
- **[master-architecture-document.md](./master-architecture-document.md)** - ✅ System overview (Note: Some details may be outdated)
- **[system-operation-guide.md](./system-operation-guide.md)** - ✅ How the system works
- **[CLAUDE.md](./CLAUDE.md)** - ✅ AI assistant guidelines

### Type System & Patterns
- **[type-error-systemic-resolution-plan.md](./type-error-systemic-resolution-plan.md)** - ✅ Type error resolution strategy
- **[standardized-error-handling.md](./standardized-error-handling.md)** - ✅ Error handling patterns

### Development Guides
- **[README.md](../README.md)** - ✅ Project setup and basic usage
- **[suwayomi-integration.md](./suwayomi-integration.md)** - ✅ Suwayomi setup and usage

### Maintenance & Operations
- **[logs-documentation.md](./logs-documentation.md)** - ✅ Logging system guide
- **[system-health-check.md](./system-health-check.md)** - ✅ Health monitoring
- **[troubleshooting-guide.md](./troubleshooting-guide.md)** - ✅ Common issues and solutions

### Validation & Tools
- **[../scripts/validation/README.md](../scripts/validation/README.md)** - ✅ Documentation validation scripts
- **[../scripts/validation/reference-checker.js](../scripts/validation/reference-checker.js)** - ✅ Real-time reference monitoring
- **[DOCUMENTATION_CONSOLIDATION_TRACKER.md](../DOCUMENTATION_CONSOLIDATION_TRACKER.md)** - ✅ Consolidation progress tracking

### Advanced Documentation Tools
- **[../scripts/documentation/version-history-tracker.js](../scripts/documentation/version-history-tracker.js)** - ✅ Git-integrated version tracking
- **[../scripts/documentation/auto-generate.js](../scripts/documentation/auto-generate.js)** - ✅ API documentation generation from code
- **[../scripts/documentation/search-index-generator.js](../scripts/documentation/search-index-generator.js)** - ✅ Full-text search index creation
- **[../scripts/documentation/link-validator.js](../scripts/documentation/link-validator.js)** - ✅ Comprehensive link validation
- **[../scripts/documentation/site-map-generator.js](../scripts/documentation/site-map-generator.js)** - ✅ Visual documentation structure

### Generated Documentation
- **[SEARCH.md](./SEARCH.md)** - 🔍 Documentation search interface (if generated)
- **[SITE_MAP.md](./SITE_MAP.md)** - 🗺️ Visual site map (if generated)
- **[generated/README.md](./generated/README.md)** - 📖 Auto-generated API docs index (if generated)

### Archive Management
- **[archive/ARCHIVE_INDEX.md](./archive/ARCHIVE_INDEX.md)** - ✅ Index of archived documentation
- **[archive/VERSION_HISTORY.md](./archive/VERSION_HISTORY.md)** - ✅ Version tracking for archived docs

## ❌ Deprecated/Conflicting Documentation

**DO NOT USE** these documents as they contain outdated or incorrect information:

### Adapter Patterns (Use adapter-pattern-unified.md instead)
- ❌ adapter-implementation-guide.md - Outdated pattern
- ❌ adapter-implementation-patterns.md - Conflicting approach
- ❌ adapter-interfaces.md - Old interface definitions

### AniList Integration (Use anilist-native-guide.md instead)
- ❌ anilist-integration.md - Contains mangal references
- ❌ anilist-adapter-implementation.md - Old implementation
- ❌ anilist-metadata-provider.md - Deprecated provider

### Authentication (Use authentication-standardization.md instead)
- ❌ auth-system.md - Incorrectly describes Lucia Auth
- ❌ production-auth-setup.md - Wrong auth system

### Testing (Use testing-guide-unified.md instead)
- ❌ testing-patterns-guide.md - Redundant
- ❌ test-patterns.md - Outdated approach

### Build System (Use build-system-standardization.md for clarity)
- ⚠️ build-system.md - Correct but needs context from standardization doc

### Component Patterns (Use component-pattern-unified.md instead)
- ⚠️ react-component-guide.md - Partial information, see unified guide
- ⚠️ ui-component-typescript-fixes.md - Specific fixes, patterns in unified guide
- ⚠️ virtualized-components-fixes.md - Specific fixes, patterns in unified guide

### API Documentation (Use api-documentation-standardized.md instead)
- ❌ api-client-improvements.md - Partial implementation details
- ❌ api-client-shared-utilities-spec.md - Outdated specification
- ❌ api-server-actions.md - Specific to server actions issue
- ❌ api-type-compatibility.md - Partial type handling info
- ❌ api-utils-fixes-summary.md - Specific fixes, see standardized guide

### Error Handling (Use error-handling-standardized.md instead)
- ❌ enhanced-error-handling-guide.md - Partial approach
- ❌ enhanced-error-handling-summary.md - Implementation summary only
- ❌ error-handling-fixes.md - Specific fixes, see standardized guide
- ❌ metadata-providers-enhanced-error-handling.md - Provider-specific, see main guide

## 📁 Archive Structure

Deprecated documents have been moved to:
```
docs/archive/
├── anilist/          # Old AniList docs
├── adapters/         # Old adapter patterns
├── testing/          # Redundant test guides
├── auth/             # Old authentication docs
├── api/              # Outdated API docs
├── error-handling/   # Old error handling patterns
├── ARCHIVE_INDEX.md  # Complete archive listing
└── VERSION_HISTORY.md # Version tracking
```

## Governance & Process Documentation

### Documentation Management
- **[DOCUMENTATION_GOVERNANCE.md](./DOCUMENTATION_GOVERNANCE.md)** - Complete governance structure, ownership model, and review processes
- **[DOCUMENTATION_MAINTENANCE_SCHEDULE.md](./DOCUMENTATION_MAINTENANCE_SCHEDULE.md)** - Detailed maintenance schedules and recurring tasks
- **[DOCUMENTATION_BEST_PRACTICES.md](./DOCUMENTATION_BEST_PRACTICES.md)** - Comprehensive writing guide and quality standards
- **[DOCUMENTATION_UPDATE_WORKFLOWS.md](./DOCUMENTATION_UPDATE_WORKFLOWS.md)** - Standard procedures for all update scenarios
- **[DOCUMENTATION_MONITORING_SETUP.md](./DOCUMENTATION_MONITORING_SETUP.md)** - Monitoring infrastructure and alerting

### Getting Started
- **[DOCUMENTATION_ONBOARDING_GUIDE.md](./DOCUMENTATION_ONBOARDING_GUIDE.md)** - New developer and contributor guide
- **[DOCUMENTATION_CONTRIBUTION_GUIDE.md](./DOCUMENTATION_CONTRIBUTION_GUIDE.md)** - How to contribute to documentation
- **[DOCUMENTATION_NAMING_CONVENTIONS.md](./DOCUMENTATION_NAMING_CONVENTIONS.md)** - File naming standards

### Templates
- **[templates/README.md](./templates/README.md)** - Overview of available templates
- **[templates/FEATURE_TEMPLATE.md](./templates/FEATURE_TEMPLATE.md)** - For new features
- **[templates/API_TEMPLATE.md](./templates/API_TEMPLATE.md)** - For API documentation
- **[templates/INTEGRATION_TEMPLATE.md](./templates/INTEGRATION_TEMPLATE.md)** - For integrations
- **[templates/MIGRATION_TEMPLATE.md](./templates/MIGRATION_TEMPLATE.md)** - For migrations

## Quick Reference Decision Tree

```
Need to know about...
├── MangaStatus enum? → manga-status-standardization-final.md
├── AniList integration? → anilist-native-guide.md
├── Adapter patterns? → adapter-pattern-unified.md
├── API development? → api-documentation-standardized.md
├── Error handling? → error-handling-standardized.md
├── AsyncResult? → async-result-standardization.md
├── Testing? → testing-guide-unified.md
├── Type organization? → type-system-architecture-standardization.md
├── Authentication? → authentication-standardization.md
├── Build commands? → build-system-standardization.md
├── Component patterns? → component-pattern-unified.md
├── Documentation standards? → DOCUMENTATION_NAMING_CONVENTIONS.md
├── Contributing docs? → DOCUMENTATION_CONTRIBUTION_GUIDE.md
├── Using templates? → templates/README.md
├── Migration help? → migration/documentation-migration-guide.md
├── System overview? → master-architecture-document.md
└── Anything else? → Check this list first!
```

## Important Notes

1. **Mangal Integration**: Mangal is ACTIVE and SUPPORTED for downloading chapters. We use native AniList for metadata only.

2. **Client Architecture**: Client consolidation is COMPLETE. We use a single enhanced client in production.

3. **Type System**: Use the actual implemented structure, not proposed directories that don't exist.

4. **Authentication**: We use NextAuth.js/Auth.js, NOT Lucia Auth.

5. **Build System**: Both `pnpm` commands and `kaizoku.sh` are valid - use what works for you.

6. **Documentation Quality**: All new documentation must follow templates and naming conventions.

7. **Documentation Tools**: Use npm scripts for documentation tasks:
   - `npm run docs:generate` - Generate API documentation
   - `npm run docs:search` - Build search index
   - `npm run docs:sitemap` - Create visual site map
   - `npm run docs:links` - Validate all links
   - `npm run docs:all` - Run all documentation tasks

## Contributing

When creating new documentation:
1. Use appropriate template from `docs/templates/`
2. Follow naming conventions in `DOCUMENTATION_NAMING_CONVENTIONS.md`
3. Check if it conflicts with canonical docs
4. Update this list if creating new canonical docs
5. Archive old docs rather than deleting them
6. Add clear deprecation warnings to outdated docs
7. Run validation tools before submitting

---

**Remember**: When in doubt, check the standardization documents first. They were created specifically to resolve conflicts and provide clear guidance.