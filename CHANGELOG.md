# Changelog

All notable changes to the Mugiwara-Kaizoku project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Project Status

**Current Version**: 0.9.0 (Pre-release)
**Target for 1.0.0**: TBD
**Total Commits**: 981+

### Version Numbering Convention (Pre-1.0)

- **0.x.0** - Major feature milestones
- **0.x.y** - Bug fixes and minor improvements
- **1.0.0** - First stable production release (when all criteria met)

### Criteria for 1.0.0 Release

- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors (max 10 warnings allowed)
- [ ] All comprehensive cleanup sprint phases complete
- [ ] Complete test coverage for critical paths
- [ ] Production-ready documentation
- [ ] Performance benchmarks met
- [ ] Security audit passed

### Tagging History

No semver releases have been cut yet. The repo contains one `v*`-prefixed tag — `v1.7.0-strict-mode-complete` — but it is a development checkpoint marker (TypeScript strict mode milestone), not a release. The `package.json` version (`0.9.0`) is the canonical version reference; ignore any other in-repo state that disagrees.

---

## [Unreleased]

### Added
- **Database Models**: Implemented 4 new Prisma models for bookmarking and auto-download features
  - `AutoDownloadRule` - Per-manga auto-download monitoring configuration
  - `BookmarkedChapter` - Chapter-level bookmarks with multi-user support
  - `BookmarkedVolume` - Volume-level bookmarks with multi-user support
  - `BookmarkedManga` - Manga-level bookmarks with multi-user support
- All models include proper indexes, unique constraints, and cascade deletes

### Fixed
- **TypeScript Type Safety**: Eliminated all 166 production code violations of `@typescript-eslint/no-unsafe-argument`
  - Fixed violations across 59 files in 13 systematic batches
  - Removed all `as any` type assertions from production code
  - Applied consistent type safety patterns (type intersections, double casting, Record types, explicit enums)
  - Production code now 100% type-safe for unsafe argument rule ✅

### Changed
- Updated Manga model with 3 new relations: `AutoDownloadRule`, `BookmarkedVolume[]`, `BookmarkedManga[]`
- Updated Chapter model with 1 new relation: `BookmarkedChapter[]`
- Removed 48 lines of type suppressions from `manga.ts` router

### Security
- **CRITICAL**: Fixed 23 OWASP Top 10:2021 vulnerabilities (4 critical, 8 high, 7 medium, 4 low)
- **A01:2021 - Broken Access Control** (10 vulns): Fixed authentication bypass, admin role bypass, system token validation, file access authorization, public API authentication
- **A02:2021 - Cryptographic Failures** (3 vulns): Replaced Math.random() with crypto.randomBytes(), enforced environment secret validation (32+ chars), increased bcrypt salt rounds (10 → 12)
- **A03:2021 - Injection** (4 vulns): SQL injection prevention, XSS prevention with DOMPurify, path traversal protection, command injection prevention
- **A05:2021 - Security Misconfiguration** (3 vulns): Debug mode requires explicit flag, production error sanitization, cache adapter pattern
- **A07:2021 - Authentication Failures** (4 vulns): Brute force protection (5 attempts/30min), JWT expiration (14d → 1d), strong password policy, session invalidation
- **A09:2021 - Logging Failures** (1 vuln): Security event logging (16 event types), log sanitization (26+ sensitive fields)
- **A10:2021 - SSRF** (1 vuln): Private IP blocking in image proxy

### Added
- `src/lib/html-sanitizer.ts` - XSS prevention utility with DOMPurify (4 sanitization profiles, URL validation)
- `src/server/utils/json-utils.ts` - Safe JSON parsing with AsyncResult pattern
- `src/server/env-validation.ts` - Environment secret validation (startup validation, weak pattern detection)
- `src/server/utils/security-logger.ts` - Security event logging system (16 event types, 26+ sensitive fields redacted)
- `src/server/utils/log-sanitizer.ts` - Credential redaction utility
- `src/server/cache/cache-adapter.ts` - Pluggable cache pattern (in-memory, Redis-ready)
- `.claude/hooks/security-check.sh` - Pre-commit security validation (27 pattern detectors, 3-tier severity system)

### Changed
- Reduced TypeScript errors from 1,497 to 14 (99% reduction, remaining are pre-existing Prisma issues)
- Installed @types/dompurify for proper type safety
- Fixed mixed operator precedence errors (|| and ?? operators)
- Fixed exactOptionalPropertyTypes violations in auth utilities
- Regenerated Prisma client for latest schema

### Documentation
- Updated `docs/development/security-guide.md` - Added 300+ line security pattern detection section
- Updated `.claude/hooks/README.md` - Added comprehensive security-check documentation
- Created security reports in `docs/security/` (OWASP remediation baseline, completion report, parallel agents summary)

### Known Issues
- 14 TypeScript errors remain (all pre-existing Prisma property issues)
- ESLint violations in multiple components (see lint report)
- Performance optimizations needed for large libraries
- Mobile UI refinements in progress

### Planned
- Complete comprehensive cleanup sprint
- Resolve remaining TypeScript errors
- Mobile UI polish
- Performance optimization phase
- Comprehensive test suite

---

## [0.9.0] - 2025-10-26

### Major Features
- **Backup System**: Complete backup file upload and restore implementation
- **Database Enhancements**: Added API keys, webhooks, reader progress, and download history models
- **Manga Detail Modal**: Three-tier hot caching with Quick Add functionality
- **Netflix-Style Home Page**: Horizontal scrolling rows with infinite scroll
- **AniList Integration**: Home page discovery sections with 327+ genres/tags support
- **Top 100 Manga**: Dedicated section with progressive loading
- **Metadata Conflict Resolution**: UI integration for unified metadata merger
- **Visual Mode**: Custom website sources with job queue integration

### Improvements
- Drag-and-drop priority ordering for metadata providers
- Enhanced TrendingBanner with randomization and transparent arrows
- Infinite scroll for genres
- Author display in home page sections and banner
- Manga deduplication feature
- Release blocklist to prevent infinite retry loops

### Bug Fixes
- Fixed reader navigation and keyboard controls
- Resolved Prisma relation property casing issues
- Corrected TypeScript type errors in reader components
- Fixed module resolution paths across 117 files

### Technical Debt
- Modularized NativeReader into reusable components and hooks
- Reduced ESLint errors by 94% (71→4) in reader components
- Achieved zero TypeScript compilation errors in reader

---

## [0.8.0] - 2025-09-07

### Major Features - Comprehensive Cleanup Sprint
- **Code Deduplication**: Eliminated 849 duplicate patterns across codebase
- **AsyncResult Migration**: Standardized all adapters to AsyncResult pattern
- **Error Handling Standardization**: Unified error handling system
- **State Management**: Consolidated loading patterns and ID conversions
- **Fandom Provider**: Enhanced search and metadata extraction

### Improvements
- Status mapping consolidated into single source of truth
- Dark theme container backgrounds fixed
- Type errors in metadata services resolved
- Prisma types migration infrastructure
- Consolidated api/ directory into server/ structure

### Bug Fixes
- Resolved all TypeScript errors (comprehensive pass)
- Fixed provider search and filtering issues
- Removed circular dependencies
- Fixed logging system after ID conversion
- Resolved Mantine v6 deprecations and tRPC v10 syntax

### Refactoring
- Import ordering standardization across 984 files
- Removed unused variables via 8 parallel agents
- Function complexity reduction (200+ lines → modular)
- Explicit return types added to all exported functions

---

## [0.7.0] - 2025-08-16

### Major Features - Unified Metadata System
- **Unified Metadata System**: Consistent data handling across all providers
- **Metadata Extraction**: Comprehensive selection system with confidence scores
- **Chapter Recreation**: During metadata refresh with detailed titles
- **Volume/Chapter Mix and Match**: Support for AniList, ComicVine, Fandom, Wikipedia

### Improvements
- Enhanced confirmation screen with metadata confidence scores
- Expandable volumes with chapter metadata display
- Rich metadata in ComicVine volume views
- Data quality warnings for Wikipedia parsing artifacts
- Prevent date years from being used as counts

### Bug Fixes
- Fixed metadata refresh removing data
- Fixed incorrect chapter/volume counts
- Fixed provider metadata not being stored
- Fixed metadata IDs and provider links
- Fixed AniList ID not being passed correctly
- Fixed bookmark icon display

### Features Added
- Provider search modal
- Chapter details display with cover art and popup modal
- Complete metadata display on manga detail page
- Advanced search syntax

---

## [0.6.0] - 2025-08-15

### Major Features - Wikipedia & ComicVine Integration
- **Wikipedia Integration**: Chapter and volume data parsing
- **ComicVine Volume Mapping**: Proper issue-to-chapter conversion
- **ML Pattern Recognition**: Unified metadata parser with pattern recognition

### Improvements
- Enhanced manga search with Wikipedia integration
- Wikipedia chapter parsing improvements (Fire Force and similar)
- Volume display shows data from multiple sources
- Proper Wikipedia chapter assignment to volumes

### Bug Fixes
- Fixed React rendering errors with chapter objects
- Filtered Wikipedia parsing artifacts
- Fixed undefined themes/aliases variables
- Fixed date display and volume table visibility
- Fixed tags and dates being passed as objects

---

## [0.5.0] - 2025-08-14

### Features
- Enhanced confirmation screen implementation
- Advanced metadata field display
- Provider badge color standardization
- Add Manga button on library page

### Bug Fixes
- Fixed metadata population and dropdown filtering
- Resolved grey AniList badge in search results
- Fixed CSS-in-JS styling warnings
- Removed duplicate Add Manga button
- Fixed FloatingActionButton rendering on desktop

---

## [0.4.0] - 2025-08-12

### Major Features
- Unified Metadata Parser with ML Pattern Recognition Engine
- Advanced search syntax support
- Enhanced confirmation screen workflow

### Improvements
- State management system implementation
- Performance optimizations (Phase 3)
- Component extraction and reusability

---

## [0.3.0] - 2025-05-28

### Features
- Core manga download functionality
- Library management system
- Provider integrations (AniList, MangaDex, ComicVine)
- Basic metadata handling

### Improvements
- Enhanced type safety (replaced 'any' assertions)
- Directory creation fixes
- Download settings improvements

---

## [0.2.0] - 2025-03-22

### Features
- UI framework updates
- Comprehensive dependency updates
- Basic theming support

---

## [0.1.0] - 2025-03-12

### Initial Release
- Initial commit of Kaizoku manga downloader
- Basic library manager functionality
- Core download infrastructure
- .gitignore configuration for large binary files

---

## Development Timeline Summary

| Version | Date | Focus Area | Commits |
|---------|------|------------|---------|
| 0.9.0 | 2025-10-26 | Backup, Home Page, Caching | ~50 |
| 0.8.0 | 2025-09-07 | Cleanup Sprint, Standardization | ~200 |
| 0.7.0 | 2025-08-16 | Unified Metadata System | ~100 |
| 0.6.0 | 2025-08-15 | Wikipedia & ComicVine | ~50 |
| 0.5.0 | 2025-08-14 | UI Enhancements | ~30 |
| 0.4.0 | 2025-08-12 | ML Parser & Search | ~20 |
| 0.3.0 | 2025-05-28 | Core Features | ~400 |
| 0.2.0 | 2025-03-22 | Framework Updates | ~50 |
| 0.1.0 | 2025-03-12 | Initial Release | ~81 |

---

## Migration Notes

### From 1.7.0 to 0.9.0

**Why the version downgrade?**

The version number was changed from `1.7.0` to `0.9.0` to reflect the true project status:

1. **Pre-release Status**: The project is feature-rich but not production-ready
2. **Active Refactoring**: Ongoing comprehensive cleanup sprint
3. **Outstanding Issues**: ESLint errors, TypeScript strict mode issues
4. **Semantic Versioning**: Per semver.org, versions below 1.0.0 indicate initial development
5. **1.0.0 Criteria**: Defined clear criteria for stable release

**Semantic Versioning Pre-1.0**:
- Major version 0 indicates **initial development**
- Minor version (0.x.0) indicates **significant feature additions**
- Patch version (0.x.y) indicates **bug fixes**

---

## Contributing

When adding entries to this changelog:

1. **Use Conventional Commits**: feat, fix, refactor, chore, docs, test, perf
2. **Update Unreleased**: Add changes to [Unreleased] section first
3. **Version Bump**: When releasing, move changes to new version section
4. **Link Issues**: Reference GitHub issues/PRs where applicable
5. **Breaking Changes**: Clearly mark with **BREAKING CHANGE** prefix

---

**Last Updated**: 2025-10-26
**Maintained By**: Development Team
