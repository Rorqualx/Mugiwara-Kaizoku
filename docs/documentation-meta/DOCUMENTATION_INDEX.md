# DOCUMENTATION_INDEX

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*  
*Last Updated: 2025-09-06*

## Overview

Master index of all documentation in the Mugiwara Kaizoku project, including structure, rules, and primary guides. Documentation has been reorganized for better maintainability and discoverability.

---

## 🚨 Documentation Rules & Maintenance

### MANDATORY READING
- **Documentation Rules**: `/docs/CLAUDE_DOCUMENTATION_RULES.md` - Comprehensive rules for maintaining docs
- **Quick Reference**: `/docs/CLAUDE_DOCS_RULES_QUICK.md` - Condensed version for daily use
- **How to Use**: `/docs/README_DOCUMENTATION_RULES.md` - Guide for developers and AI assistants

### Configuration Files
- **Claude Config**: `/claude.config.yml` - Project-specific AI configuration
- **System Prompt**: `/docs/CLAUDE_SYSTEM_PROMPT_ADDON.md` - Add to AI system prompts
- **Pre-commit Hook**: `/docs/hooks/pre-commit-docs` - Automated compliance checking

### Key Rule: Always Update, Rarely Create
```bash
# Before creating ANY documentation:
find /docs -iname "*topic*.md" -type f
ls /docs/*/*-guide.md
```

---

## 📚 Primary Documentation Guides

### Core System Documentation
- **Database**: `/docs/database/database-guide.md` - Complete database documentation
- **Architecture**: `/docs/architecture/architecture-overview.md` - System architecture guide
- **Testing**: `/docs/testing/testing-guide.md` - Comprehensive testing documentation
- **Development**: `/docs/development/development-guide.md` - Development standards and practices

### Integration Documentation
- **AniList**: `/docs/adapters-clients/anilist-guide.md` - AniList integration guide
- **Fandom**: `/docs/adapters-clients/fandom-adapter-guide.md` - Fandom adapter documentation
- **Download Clients**: `/docs/adapters-clients/download-clients-guide.md` - All download client docs
- **API Clients**: `/docs/adapters-clients/api-client-reference.md` - API client reference

### Technical References
- **TypeScript**: `/docs/typescript/typescript-patterns-guide.md` - TypeScript patterns and standards
- **Configuration**: `/docs/configuration/configuration-system.md` - Configuration management
- **Build System**: `/docs/build-system/` - Build and deployment documentation

---

## Documentation Structure

This document outlines the organization of the Mugiwara-Kaizoku documentation after consolidation.

## Directory Structure

### `/adapters-clients/`
Contains documentation for all adapters and clients used in the system:
- AniList adapter documentation
- MangaDex adapter documentation  
- Fandom adapter documentation
- ComicVine adapter documentation
- Download client adapters (Deluge, Transmission, NZBGet)
- Prowlarr integration
- Client consolidation and fixes

### `/api/`
API-related documentation:
- API implementation phases and summaries
- API error handling examples
- Router documentation
- tRPC endpoint documentation
- `/v1/` - Version 1 API documentation

### `/architecture/`
System architecture documentation:
- Architectural audits
- Backend architecture diagrams
- Backend consolidation plans
- Domain model documentation
- Architecture migration guides

### `/build-system/`
Build system and production setup:
- Build system fixes and improvements
- Production build guides
- Build command documentation
- Next.js build configuration

### `/components/`
UI component documentation:
- Component development guides
- Form components and state management
- Provider selection forms
- Mantine and Tabler Icons documentation
- React component patterns

### `/configuration/`
Configuration and settings documentation:
- Configuration system guides
- Settings consolidation
- Environment variables
- Authentication configuration
- Client settings documentation

### `/database/`
Database and schema documentation:
- Database schema recreation guides
- Prisma type migrations
- PostgreSQL permissions
- Schema cleanup documentation

### `/development/`
Developer resources:
- Development guides and rules
- Code style guides
- Git hooks setup
- CI/CD workflows
- Error handling patterns
- TypeScript patterns
- Package management

### `/documentation-meta/`
Documentation about documentation:
- Documentation best practices
- Documentation governance
- Naming conventions
- Maintenance schedules
- Style guides
- Contribution guides

### `/features/`
Feature-specific documentation:
- `/download-system/` - Download system features
- `/integration/` - Integration features
- `/reader/` - Reader integration
- `/search-filter/` - Search and filter functionality
- `/user-management/` - User management features
- Enhanced chapter titles
- Missing items detection

### `/fixes-summaries/`
Collection of fix summaries and reports:
- TypeScript fixes
- Component fixes
- Navigation fixes
- Various bug fix documentation

### `/hooks/`
React hooks documentation:
- Custom hook implementations
- Hook TypeScript fixes
- useConfig, useManga, useMetadata documentation
- Hook consolidation guides

### `/integrations/`
External service integrations:
- Integration patterns
- Metadata provider integrations
- Cross-provider enrichment
- Integration status and troubleshooting

### `/kapowarr/`
Kapowarr integration documentation:
- Developer guides
- Implementation summaries
- Quick start guides
- Integration progress tracking

### `/migration/`
Migration guides:
- Architecture migration
- Data model conversions
- Auth.js v5 migration
- Metadata system migrations
- TypeScript migration guides

### `/system/`
System-level documentation:
- Event system
- Notification system
- Task management
- Queue manager
- Logger documentation
- System status pages

### `/testing/`
Testing documentation:
- Testing guides
- Test templates
- Test migration plans
- Test quality standards
- Debugging guides

### `/typescript/`
TypeScript-specific documentation:
- TypeScript configuration
- Type system architecture
- TypeScript fixes and improvements
- Type conversion utilities
- TypeScript patterns and best practices

### `/ui-ux/`
UI/UX documentation:
- Mobile optimization guides
- UI improvements
- Navigation fixes
- Page-specific documentation

### `/user-guides/`
End-user documentation:
- Quick start guides
- Troubleshooting guides
- Suwayomi setup
- Admin setup options
- Calendar user guide
- Download client guides

### `/archive/`
Archived documentation:
- Deprecated features
- Legacy code documentation
- Old implementation plans
- Phase reports
- Consolidation history
- `/adapter-fixes/` - Archived adapter fixes
- `/analysis-documents/` - Archived analyses
- `/component-fixes/` - Archived component fixes
- `/consolidated-files/` - Previously consolidated docs
- `/hook-fixes/` - Archived hook fixes
- `/nzbget-legacy/` - Legacy NZBGet documentation
- `/phase-reports/` - Project phase reports
- `/planning-documents/` - Archived planning docs
- `/typescript-fixes/` - Archived TypeScript fixes

### Other Directories
- `/backups/` - Documentation backups
- `/build-typescript/` - TypeScript build documentation
- `/examples/` - Code examples
- `/migration/` - Migration specific docs
- `/navigation-issue-diagnosis/` - Navigation debugging
- `/project-info/` - Project information
- `/project-planning/` - Planning documents
- `/reader-integration/` - Reader integration docs
- `/research/` - Research documents
- `/templates/` - Documentation templates

## 📋 Recent Reorganization (2025-09-06)

### Documentation Moved from Root
All 66 markdown files that were in the project root have been organized into appropriate folders:
- **TypeScript Migration**: 13 files → `/docs/migration/typescript-migration/`
- **Phase Reports**: 18 files → `/docs/migration/phase-reports/`
- **Error Fixes**: 7 files → `/docs/fixes-summaries/error-fixes/`
- **Type Fixes**: 14 files → `/docs/fixes-summaries/type-fixes/`
- **Console Migration**: 3 files → `/docs/migration/console-migration/`
- **Code Cleanup**: 6 files → `/docs/migration/code-cleanup/`
- **Breaking Changes**: 1 file → `/docs/project-info/breaking-changes/`
- **System**: 2 files → `/docs/system/`
- **Kapowarr**: 1 file → `/docs/kapowarr/fixes/`
- **Testing**: 1 file → `/docs/testing/test-reports/`

### Folder Consolidation
The following duplicate or similar folders were consolidated:
- `architecture-migration` → `/docs/migration/architecture/`
- `migration-archive` → `/docs/archive/migration-history/`
- `session-notes` → `/docs/archive/session-notes/`
- `project-planning/session` → `/docs/archive/planning-sessions/`
- `navigation-issue-diagnosis` → `/docs/troubleshooting/navigation/`
- `reader-integration` → `/docs/features/reader/`
- `known-issues` → `/docs/troubleshooting/`
- `build-typescript` → `/docs/build-system/`
- `standards` → `/docs/documentation-meta/`
- `events` → `/docs/system/events/`
- `refactoring` → `/docs/migration/refactoring/`
- `consolidation-work` → `/docs/archive/consolidation-work/`

### Cleanup Performed
- Removed all empty directories
- Fixed folder naming (removed spaces, used kebab-case)
- Organized loose migration files from docs root

## Root Documentation Files

- `CANONICAL_DOCS.md` - Main documentation index
- `README.md` - Documentation overview

## Organization Scripts

The following scripts were used to organize the documentation:
- `/scripts/organize-docs.sh` - Moved root markdown files to docs folders
- `/scripts/organize-docs-phase2.sh` - Consolidated duplicate folders and cleaned structure

These scripts can be referenced if you need to understand how files were categorized.
