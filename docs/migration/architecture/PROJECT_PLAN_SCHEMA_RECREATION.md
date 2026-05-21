# PROJECT_PLAN_SCHEMA_RECREATION

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for PROJECT_PLAN_SCHEMA_RECREATION

---
# Kaizoku Schema Recreation Project Plan

## Executive Summary

Transition from Prisma migrations to a schema recreation approach for development environments to improve simplicity and development velocity. This plan includes comprehensive analysis of all services, database requirements consolidation, and phased implementation.

## Project Scope

**Objective**: Replace the current 25+ migration files with a single, comprehensive schema that can be recreated from scratch for development environments.

**Benefits**:
- Simplified development environment setup
- Faster database resets during development
- Cleaner schema without migration artifacts
- Easier onboarding for new developers
- Elimination of migration dependency chains

## Phase 1: Investigation & Analysis

### 1.1 Download Services Analysis

#### Download Clients
Based on the Settings model and configurations, the following download clients are supported:

**Torrent Clients**:
- **Deluge** (delugeEnabled, delugeBaseURL, delugePassword)
  - Database needs: Connection credentials, status tracking
  - Settings: Base URL (default: http://localhost:8112), password
  
- **Transmission** (transmissionEnabled, transmissionBaseURL, transmissionApiKey)
  - Database needs: API key management, endpoint configuration
  - Settings: Base URL (default: http://localhost:9091), API key

**Usenet Clients**:
- **SABnzbd** (sabnzbdEnabled, sabnzbdBaseURL, sabnzbdApiKey)
  - Database needs: API key, server endpoint, queue monitoring
  - Settings: Base URL (default: http://localhost:8080), API key
  
- **NZBGet** (nzbgetEnabled, nzbgetBaseURL, nzbgetUsername, nzbgetPassword)
  - Database needs: Credentials, server configuration
  - Settings: Base URL (default: http://localhost:6789), username/password

**Search/Indexing**:
- **Prowlarr** (prowlarrEnabled, prowlarrBaseURL, prowlarrApiKey)
  - Database needs: API configuration, indexer management
  - Settings: Base URL, API key, auto-selection preferences

### 1.2 Metadata Providers Analysis

#### Primary Metadata Sources
- **AniList** (anilistEnabled, anilistUseForMetadata)
  - Database needs: Metadata caching, search results, mapping
  - Features: Cover images, summaries, genres, authors, status, dates
  
- **ComicVine** (integrations/comicvine.ts)
  - Database needs: API rate limiting, result caching
  - Features: Detailed comic metadata, character information
  
- **Fandom** (integrations/fandom.ts)
  - Database needs: Wiki scraping results, content caching
  - Features: Community-driven metadata, alternative titles
  
- **MangaDex** (integrations/mangadx.ts)
  - Database needs: Chapter tracking, translation metadata
  - Features: Multi-language support, chapter availability

#### Metadata Conflict Resolution
- **MetadataConflict** table for manual resolution
- **MetadataFieldPreference** for provider prioritization
- **Metadata** table with comprehensive field coverage

### 1.3 Media Server Integration Analysis

#### Supported Media Servers
- **Kavita** (kavitaEnabled, kavitaHost, kavitaLibraries, kavitaUser, kavitaPassword)
  - Database needs: Library synchronization, reading progress
  - Features: Web-based manga reader, library management
  
- **Komga** (komgaEnabled, komgaHost, komgaLibraries, komgaUser, komgaPassword)
  - Database needs: Collection sync, metadata exchange
  - Features: Comic/manga server with API integration
  
- **Suwayomi** (suwayomiEnabled, suwayomiServerPath, suwayomiConfigPath, suwayomiPort, suwayomiSources)
  - Database needs: Source management, server configuration
  - Features: Tachiyomi-compatible server, extension support
  
- **Mangal** (mangalEnabled, mangalHost, mangalLibraries, mangalUser, mangalPassword)
  - Database needs: Download coordination, source configuration
  - Features: CLI-based manga downloader

### 1.4 Core Application Features Analysis

#### Authentication & Authorization
- **User** model: CRUD operations, role management
- **Session** model: Security, expiration tracking
- **UserRole** enum: ADMIN, USER permissions

#### Library Management
- **Library** model: Filesystem path management, organization
- **Manga** model: Core entity with extensive metadata
- **Chapter** model: File tracking, download status, resolution metadata

#### Task Management & Processing
- **Task** model: Comprehensive background job system
- **Queue** model: Concurrent processing, retry logic, rate limiting
- **BatchOperation** model: Bulk chapter operations

#### Backup & Maintenance
- **Backup** model: Automated backup system with retention
- **SystemEvent** model: Operational logging and monitoring
- **Config** model: Centralized configuration management

#### File Organization & Monitoring
- File organization settings (JSON configuration)
- Out-of-sync chapter tracking and resolution
- Metadata conflict detection and resolution

### 1.5 Settings & Configuration Analysis

#### Notification Systems
- **Telegram** (telegramEnabled, telegramToken, telegramChatId, telegramSendSilently)
- **Apprise** (appriseEnabled, appriseHost, appriseUrls)

#### Backup Configuration
- Schedule management (BackupSchedule enum: DAILY, WEEKLY, MONTHLY, CUSTOM)
- Content selection (BackupContent enum: DATABASE, CONFIGURATION, MEDIA_FILES)
- Retention policies (backupRetentionDays, backupMaxCount)

#### Advanced Features
- Custom cron expressions for scheduling
- Event settings and retention policies
- Metadata field preferences with provider prioritization
- Quality profiles and resolution management

## Phase 2: Database Schema Consolidation

### 2.1 Core Entity Relationships

```
User 1:N Session
User 1:N SystemEvent (optional relation)

Library 1:N Manga
Manga 1:1 Metadata (optional)
Manga 1:N Chapter
Manga 1:N MetadataConflict
Manga 1:N OutOfSyncChapter
Manga 1:N BatchOperation
Manga 1:N Task

Chapter 1:N OutOfSyncChapter
Chapter 1:N Task

Queue 1:N Task

Settings 1:N MetadataFieldPreference
```

### 2.2 Essential Indexes for Performance

```sql
-- High-frequency query patterns
CREATE INDEX idx_manga_source_status ON Manga(source, status);
CREATE INDEX idx_manga_last_checked ON Manga(lastChecked);
CREATE INDEX idx_manga_search_provider ON Manga(searchProvider);
CREATE INDEX idx_chapter_download_status ON Chapter(downloadStatus);
CREATE INDEX idx_task_type_status ON Task(type, status);
CREATE INDEX idx_task_scheduled_at ON Task(scheduledAt);
CREATE INDEX idx_system_event_timestamp ON SystemEvent(timestamp);
CREATE INDEX idx_system_event_level ON SystemEvent(level);
```

### 2.3 Data Retention Requirements

**Critical Data (Always Preserve)**:
- User accounts and authentication
- Library configurations and paths
- Manga metadata and chapter information
- System configuration and settings

**Operational Data (Development Safe to Reset)**:
- Task queues and job history
- System events and logs
- Temporary download status
- Cache and conflict resolution data

**Backup Data (Archive Before Reset)**:
- Completed backup records
- Historical operational metrics

## Phase 3: Schema Consolidation Strategy

### 3.1 Unified Schema Design

**Primary Tables** (Core functionality):
1. `User` - Authentication and authorization
2. `Session` - Security management
3. `Library` - File system organization
4. `Manga` - Central content entity
5. `Chapter` - File and download tracking
6. `Metadata` - Comprehensive content metadata

**Integration Tables** (External services):
7. `Settings` - Centralized configuration
8. `MetadataFieldPreference` - Provider preferences
9. `MetadataConflict` - Manual resolution tracking

**Processing Tables** (Background operations):
10. `Task` - Job management
11. `Queue` - Processing control
12. `BatchOperation` - Bulk operations
13. `OutOfSyncChapter` - Sync management

**System Tables** (Monitoring and maintenance):
14. `SystemEvent` - Operational logging
15. `Backup` - Backup management
16. `Config` - Advanced configuration

### 3.2 Migration Archive Strategy

Create archive directory structure:
```
.archive/
├── migrations/
│   ├── schema-snapshots/
│   ├── migration-sql/
│   └── migration-history.md
├── backups/
│   ├── pre-migration-schema.sql
│   └── data-export-YYYY-MM-DD.sql
└── documentation/
    ├── migration-analysis.md
    └── breaking-changes.md
```

## Phase 4: Implementation Plan

### 4.1 Pre-Implementation (Week 1)

**Day 1-2: Environment Preparation**
- [ ] Create feature branch: `schema-recreation`
- [ ] Backup current database schema and data
- [ ] Document current migration state
- [ ] Set up parallel development database

**Day 3-5: Archive Creation**
- [ ] Create `.archive` directory structure
- [ ] Move existing migrations to archive
- [ ] Generate comprehensive migration history documentation
- [ ] Export current schema as reference

### 4.2 Schema Development (Week 2)

**Day 1-3: Core Schema Creation**
- [ ] Create new `schema.prisma` with all models
- [ ] Include all enums and relationships
- [ ] Add comprehensive indexes for performance
- [ ] Validate schema completeness against current migration

**Day 4-5: Schema Validation**
- [ ] Generate Prisma client from new schema
- [ ] Compare generated types with existing
- [ ] Run schema validation tests
- [ ] Document any breaking changes

### 4.3 Integration Testing (Week 3)

**Day 1-2: Database Recreation Testing**
- [ ] Test `prisma db push --force-reset` workflow
- [ ] Validate all tables and relationships
- [ ] Test data seeding and initialization
- [ ] Performance benchmark against migrated database

**Day 3-4: Application Integration**
- [ ] Test all CRUD operations
- [ ] Validate ORM query compatibility
- [ ] Test all service integrations
- [ ] Verify authentication and authorization

**Day 5: Development Workflow Testing**
- [ ] Test development environment setup
- [ ] Validate database reset procedures
- [ ] Test with different PostgreSQL versions
- [ ] Document new development workflows

### 4.4 Script and Documentation (Week 4)

**Day 1-2: Automation Scripts**
- [ ] Create `scripts/db-recreate.sh` script
- [ ] Update package.json scripts
- [ ] Create development setup documentation
- [ ] Update Docker configurations

**Day 3-4: Developer Documentation**
- [ ] Update README.md with new setup instructions
- [ ] Create migration transition guide
- [ ] Document rollback procedures
- [ ] Update contribution guidelines

**Day 5: Final Validation**
- [ ] End-to-end testing in clean environment
- [ ] Validate with team members
- [ ] Performance and functionality sign-off
- [ ] Prepare for production deployment

## Phase 5: Deployment and Adoption

### 5.1 Development Environment Rollout

**Week 1: Team Preparation**
- [ ] Team training on new workflow
- [ ] Distribute updated development setup guide
- [ ] Provide migration transition assistance
- [ ] Monitor for adoption issues

**Week 2: Full Adoption**
- [ ] Archive old migration files
- [ ] Update CI/CD pipelines for development
- [ ] Remove migration-related scripts
- [ ] Clean up documentation

### 5.2 Production Considerations

**Important Notes**:
- This change affects DEVELOPMENT environments only
- Production databases will continue using migrations
- Staging environments may use either approach
- Data preservation remains critical for production

**Production Migration Strategy** (Future):
- Keep current migration system for production
- Potential future consideration for blue-green deployments
- Database branching strategies for production schema changes

## Risk Assessment and Mitigation

### High Risk Areas

1. **Data Loss in Development**
   - Mitigation: Clear documentation, backup procedures
   - Impact: Low (development data is disposable)

2. **Schema Drift Between Environments**
   - Mitigation: Automated schema validation, CI checks
   - Impact: Medium (could affect testing accuracy)

3. **Team Adoption Resistance**
   - Mitigation: Training, clear benefits communication
   - Impact: Medium (affects development velocity)

### Low Risk Areas

1. **Performance Impact**
   - Expected: Improved (no migration overhead)
   - Monitoring: Development environment performance

2. **Tool Compatibility**
   - Expected: Maintained (same Prisma version)
   - Validation: Comprehensive testing

## Success Metrics

1. **Development Velocity**
   - Database setup time: < 30 seconds (vs current ~5 minutes)
   - Clean environment creation: < 1 minute
   - New developer onboarding: < 10 minutes for database setup

2. **Maintainability**
   - Single source of truth for schema
   - Elimination of migration conflicts
   - Simplified troubleshooting

3. **Team Satisfaction**
   - Developer feedback on new workflow
   - Reduced support requests for database issues
   - Improved development experience

## Timeline Summary

- **Week 1**: Preparation and archiving
- **Week 2**: Schema development and validation  
- **Week 3**: Integration and compatibility testing
- **Week 4**: Scripts, documentation, and final validation
- **Week 5**: Team rollout and adoption
- **Week 6**: Full adoption and cleanup

**Total Estimated Effort**: 6 weeks
**Key Milestone**: Week 4 completion enables parallel development
**Go-Live Target**: Week 5 for team adoption

## Next Steps

1. **Immediate Actions**:
   - [ ] Get stakeholder approval for project plan
   - [ ] Schedule team briefing on changes
   - [ ] Set up development environment for testing
   - [ ] Begin Phase 1 investigation

2. **Resource Requirements**:
   - 1 Senior Developer (primary implementer)
   - 0.5 DevOps Engineer (CI/CD updates)
   - Team time for adoption and testing

3. **Dependencies**:
   - Team availability for testing and feedback
   - Stable development environment for testing
   - Approval for temporary workflow disruption

---

*This plan prioritizes development simplicity while maintaining production stability. All changes are reversible and focused on improving developer experience.*