# Architecture Overview

*Status: Active*  
*Author: Architecture Team*  
*Canonical: Yes*

## Overview

Comprehensive architectural documentation for the Mugiwara Kaizoku manga management system, covering system design, component relationships, and architectural decisions.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Component Relationships](#component-relationships)
5. [Architectural Patterns](#architectural-patterns)
6. [Future Considerations](#future-considerations)

## System Architecture

### High-Level Overview
Mugiwara Kaizoku follows a modern web application architecture with:
- **Frontend**: Next.js React application
- **Backend**: Node.js with Express and tRPC
- **Database**: PostgreSQL with Prisma ORM
- **External Services**: Multiple manga metadata providers

### Key Principles
- Separation of concerns
- Type safety throughout the stack
- Modular component design
- API-first development

## Backend Architecture

[Content from backend-architecture-diagrams.md and architectural-audit.md]

### Core Components
1. **API Layer**: tRPC endpoints for type-safe communication
2. **Service Layer**: Business logic and orchestration
3. **Data Layer**: Prisma models and database access
4. **Integration Layer**: External API adapters

### API Structure
```
/api
├── routers/         # tRPC routers
├── services/        # Business logic
├── adapters/        # External integrations
└── utils/           # Shared utilities
```

## Frontend Architecture

### Component Structure
```
/components
├── common/          # Shared components
├── features/        # Feature-specific components
├── layouts/         # Layout components
└── providers/       # Context providers
```

### State Management
- React Query for server state
- Context API for UI state
- Local storage for preferences

## Component Relationships

[Diagrams from backend-architecture-diagrams.md]

### Data Flow
1. User interaction → React component
2. Component → tRPC client
3. tRPC router → Service layer
4. Service → Database/External API
5. Response flows back through layers

### Unified Add-to-Download Pipeline

When a user adds a manga, the system runs a single linear pipeline that
fans out to every enabled metadata provider, then to every enabled release
indexer, then dispatches downloads in pack-first order:

```
manga.add (server)              persists Manga + AutoDownloadRule (~285ms)
    │
    ▼
manga.oneClickEnrich (frontend-chained)
    │
    ├─► PhaseProviderFetch      Promise.allSettled across 7 providers
    │   (phase-provider-fetch)  (AniList, MangaDex, ComicVine, Fandom,
    │                            Wikipedia, MangaUpdates, MAL/Jikan)
    │
    ├─► Phases 2-5              chapter reconciliation, volume validation,
    │                            covers, finalize
    │
    └─► Phase 6 + post-hooks    completeness audit, then:
        ├─ maybeSyncSuwayomiChapters   (cross-source rows)
        └─ maybeTriggerAutoDownload    →  unifiedReleaseSearch.run(mangaId)
                                                │
                                                ▼
                                  PhaseIndexerSearch
                                  (Promise.allSettled across 4 sources)
                                    ├─ Prowlarr   pack candidates
                                    ├─ MangaDex   chapter candidates
                                    ├─ Suwayomi   chapter candidates (auto-match)
                                    └─ GetComics  (placeholder)
                                                │
                                                ▼
                                  releaseDispatcher (pack-first)
                                    Pass A: Prowlarr packs win for chapters
                                            they cover; legacy Prowlarr
                                            dispatch path runs.
                                    Pass B: native chapter candidates fill
                                            uncovered chapters (MangaDex →
                                            Suwayomi → GetComics).
                                    Idempotent via NativeDownload
                                    QUEUED/DOWNLOADING check.
                                                │
                                                ▼
                                  Queue handlers
                                    JobType.mangadex_download
                                    JobType.suwayomi_download
                                    Prowlarr → DownloadManager →
                                      Transmission / Deluge / SAB / NZBGet
                                                │
                                                ▼
                                  Library path; pack-import-handler
                                  ingests CBZs identically regardless of
                                  source.
```

**Key files:**
- `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts` — runs the 6-phase metadata enrichment.
- `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/post-enrichment-hooks.ts` — post-Phase-6 entry points into Suwayomi sync + release search.
- `src/server/services/library/indexerSearch/phase-indexer-search.ts` — release-search fan-out.
- `src/server/services/library/releaseDispatcher/dispatch.ts` — pack-first ranker + idempotent enqueue.
- `src/server/queue/handlers/{mangadex,suwayomi}-download.ts` — native CBZ producers.

**Cross-source dedup invariant:** chapter rows are deduped by
`(mangaId, chapterNumber)` in code (no schema-level unique yet). All download
handlers prefer that lookup before falling back to source-specific id, and
backfill the source id when an existing row matches.

## Architectural Patterns

### Design Patterns
- **Adapter Pattern**: For external API integrations
- **Repository Pattern**: For data access
- **Factory Pattern**: For object creation
- **Observer Pattern**: For event handling

### Code Organization
- Feature-based structure
- Shared utilities and types
- Consistent naming conventions
- Clear separation of concerns

## Future Considerations

[Content from backend-consolidation-plan.md]

### Planned Improvements
- Microservices migration consideration
- GraphQL adoption evaluation
- Performance optimization strategies
- Scalability enhancements

---

## Related Documentation
- [Database Guide](../database/database-guide.md)
- [Development Guide](../development/development-guide.md)
- [API Documentation](../api/api-reference.md)
