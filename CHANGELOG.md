# Changelog

All notable changes to the Mugiwara-Kaizoku project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Project Status

**Current Version**: 0.10.0 (Pre-release)
**Target for 1.0.0**: TBD

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

No semver releases have been cut yet. The repo contains one `v*`-prefixed tag — `v1.7.0-strict-mode-complete` — but it is a development checkpoint marker (TypeScript strict mode milestone), not a release. The `package.json` version (`0.10.0`) is the canonical version reference; ignore any other in-repo state that disagrees.

---

## [Unreleased]

_No unreleased changes yet. New work lands here before the next version is cut._

---

## [0.10.0] - 2026-06-23

### Major Features - Multi-User & Per-User Libraries
- **Per-user libraries**: Each user gets their own libraries on top of a shared, deduplicated title catalog
- **Multi-tenancy isolation**: Downloads, jobs, history, and auto-download subscriptions are now scoped per user
- **Library memberships**: Add-time library picker with per-library attribution; any user can add a title another already owns without duplicating it
- **Default library**: A standard "My Manga" library is auto-created for every user
- **Per-user content filters**: Content/age filters apply per request-user via async-local-storage, with seeded preference defaults
- **Per-user config overrides**: Reusable override layer plus per-user system events
- **Realtime isolation**: Job and download WebSocket events are delivered per user

### Major Features - Living Covers
- **Animated "living" covers**: Static character layer over a drifting, inpainted background, generated in-app
- **Segmentation tiers**: SAM and Grounded-SAM object segmentation with per-object motion; WD14 tag-driven mood-aware effects
- **Global motion control**: Calm / Normal / Lively speed setting (off by default), with in-app generation, model-download progress, and torch auto-provisioning

### Major Features - Metadata Selector System
- **Selector cutover**: A new per-field metadata selector (numeric, categorical, string, list, structured) is now the primary picker, with authority weights and per-field-type thresholds
- **Provenance & freshness**: Provenance badges, selection history, sticky-binding freshness checks, and periodic Fandom/Wikipedia/ComicVine/MangaUpdates/Kitsu freshness audits
- **Recommendations & relations**: MyAnimeList recommendations (via Jikan), AniList recommendations, and related-works from MangaRelation

### Major Features - Single-Container Docker
- **Streamlined deployment**: Single-container Docker Compose with bundled PostgreSQL and a dual-mode entrypoint
- **Bundled FlareSolverr**: Chrome and GUI libraries bundled in-image for FlareSolverr
- **Zero-config secrets**: Session/auth secrets auto-generated on first boot

### Improvements
- **Manga detail page**: Related-works and reading-order carousels, clickable publisher chip + browse-by-publisher page, cover/banner override picker with manual pin, themes/tags chip rows, and multi-source rating display
- **Access control**: Infrastructure/system pages are admin-gated; per-user pages stay open; fixed a missing-chapters information leak
- **Download reliability**: Reject video releases mislabeled as manga; native fallback when a Prowlarr pack claims but never delivers; source-aware dedup that won't clobber chapters another source already has
- **Self-healing**: Full archive-coverage heal at scan completion, passive heal in the download monitor, and detection/repair of wedged or stale Suwayomi bindings
- **MangaDex pacing**: At-home endpoint paced to eliminate monitored-search 429s
- **API platform**: Completed the designed v1 API surface

### Performance
- **Library payloads**: `manga.query` and `library.query` slimmed dramatically (~27 MB to KB) by dropping unused chapter rows, `Metadata` includes, and `providerMetadata`/`galleryImages`
- **SQL aggregates**: Chapter completeness aggregates computed in SQL instead of per-row JavaScript
- **Rendering & polling**: Virtualized the detailed library view; gated jobs-page polling on socket state; cached cover manifests
- **Enrichment**: Parallelized the provider retry tail and shared volume-page work

### Security
- **Auth hardening**: Self-provision a stable NextAuth secret when none is configured; keep middleware edge-safe by reading the JWT secret from env; dropped a weak `NEXTAUTH_SECRET` Docker Compose default
- **Session correctness**: Logout stays on the current origin; removed a signout route that shadowed NextAuth

### Fixed
- Re-home shared titles on library delete to prevent data loss; remove a user's memberships for a library's titles when that library is deleted
- Numerous manga-detail layout fixes (page/banner/carousel horizontal overflow and right-shift)
- Header library search now mounts its provider; navigation targets the library index correctly

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
| 0.10.0 | 2026-06-23 | Multi-User Libraries, Living Covers, Metadata Selector, Single-Container Docker | ~356 |
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

**Last Updated**: 2026-06-23
**Maintained By**: Development Team
