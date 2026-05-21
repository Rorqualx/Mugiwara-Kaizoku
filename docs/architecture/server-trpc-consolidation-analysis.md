# Server-tRPC Layer Consolidation Analysis

*Status: Active*  
*Author: Architecture Team*  
*Date: January 2025*  
*Canonical: Yes*

## Executive Summary

The Server layer has significant overlap with tRPC routers, creating a **dual API system** where both REST endpoints (`/api/v1/`) and tRPC procedures handle the same operations. This analysis identifies consolidation opportunities to unify around tRPC as the single API layer.

## Current Architecture Overview

### Dual API System

The application currently maintains **TWO parallel API systems**:

1. **tRPC System** (Primary - 142 files using)
   - Location: `src/server/trpc/routers/`
   - Access: Via tRPC client in components
   - Authentication: Built-in with context
   - Type Safety: Full end-to-end

2. **REST API System** (Secondary)
   - Location: `src/pages/api/v1/`
   - Access: Direct HTTP calls
   - Authentication: Custom middleware
   - Type Safety: Manual validation with Zod

### Duplication Examples

#### Manga Operations

**tRPC Router** (`src/server/trpc/routers/manga.ts`):
```typescript
export const mangaRouter = router({
  add: procedure.input(addMangaSchema).mutation(...),
  query: procedure.query(...),
  get: procedure.input(z.object({id})).query(...),
  update: procedure.input(updateSchema).mutation(...),
  remove: procedure.input(z.object({id})).mutation(...)
});
```

**REST API** (`src/pages/api/v1/manga/index.ts`):
```typescript
// GET /api/v1/manga - List manga
// POST /api/v1/manga - Create manga
const adapter = createMangaApiAdapter(config);
// Duplicate logic using MangaApiAdapter
```

**Server API Adapter** (`src/server/api/adapters/MangaApiAdapter.ts`):
```typescript
export class MangaApiAdapter extends BaseApiAdapter {
  async listManga(...) { /* Same logic as tRPC query */ }
  async createManga(...) { /* Same logic as tRPC add */ }
  async updateManga(...) { /* Same logic as tRPC update */ }
}
```

## Architecture Problems

### 1. Triple Implementation

Each operation is implemented **THREE times**:
- tRPC procedure
- REST endpoint
- API adapter class

### 2. Inconsistent Business Logic

- **tRPC**: Direct Prisma calls with inline logic
- **REST**: Uses API adapters with different validation
- **Adapters**: Additional abstraction layer with own error handling

### 3. Authentication Fragmentation

- **tRPC**: Uses context-based auth (`ctx.session`)
- **REST**: Uses custom middleware (`apiMiddleware`)
- **Different permission models** between systems

### 4. Type Safety Issues

- **tRPC**: Automatic type inference
- **REST**: Manual Zod schemas that can drift
- **API Adapters**: Manual type conversions (status enums, etc.)

## Server Layer Components Analysis

### Server API Adapters (`src/server/api/adapters/`)

| Adapter | Purpose | Used By | Can Replace With |
|---------|---------|---------|------------------|
| MangaApiAdapter | Manga CRUD | REST API only | tRPC procedures |
| LibraryApiAdapter | Library ops | REST API only | tRPC procedures |
| MetadataApiAdapter | Metadata ops | REST API only | tRPC procedures |
| SearchApiAdapter | Search ops | REST API only | tRPC procedures |
| DownloadApiAdapter | Downloads | REST API only | tRPC procedures |
| BatchApiAdapter | Batch ops | Internal only | tRPC procedures |
| WebSocketApiAdapter | WebSocket | Special case | Keep separate |
| MetricsApiAdapter | Metrics | Monitoring | Keep separate |

**Finding**: 6 of 8 adapters are redundant with tRPC.

### REST API Endpoints (`src/pages/api/v1/`)

| Endpoint | Files | Purpose | tRPC Equivalent |
|----------|-------|---------|-----------------|
| /manga/* | 5 files | Manga CRUD | mangaRouter |
| /libraries/* | 4 files | Library ops | libraryRouter |
| /chapters/* | 3 files | Chapter ops | mangaRouter |
| /search | 1 file | Search | searchRouter |
| /metadata/* | 2 files | Metadata | metadataRouter |

**Finding**: All REST endpoints have tRPC equivalents.

### Server Services (`src/server/services/`)

Services are shared between tRPC and REST, but with different access patterns:

| Service | tRPC Usage | REST Usage | Recommendation |
|---------|------------|------------|----------------|
| metadataService | Direct calls | Via adapter | Keep, use directly |
| downloadManager | Direct calls | Via adapter | Keep, use directly |
| searchService | Direct calls | Via adapter | Keep, use directly |
| configService | Direct calls | Via adapter | Keep, use directly |

## Consolidation Strategy

### Phase 1: Unify Around tRPC (Recommended)

**Remove REST API entirely** and use tRPC for all operations:

```typescript
// Before: Duplicate implementations
// REST: POST /api/v1/manga
// tRPC: mangaRouter.add

// After: Single tRPC implementation
mangaRouter.add.mutation(async ({ input, ctx }) => {
  // Single source of truth for business logic
  return mangaService.createManga(input);
});
```

### Phase 2: Service Layer Consolidation

Move business logic from adapters to services:

```typescript
// Before: Logic in adapter
class MangaApiAdapter {
  async createManga(data) {
    // Business logic here
    const manga = await prisma.manga.create(...);
    // More logic
    return manga;
  }
}

// After: Logic in service
class MangaService {
  async createManga(data) {
    // All business logic here
    return prisma.manga.create(...);
  }
}

// tRPC just calls service
mangaRouter.add.mutation(({ input, ctx }) => 
  mangaService.createManga(input)
);
```

### Phase 3: Remove API Adapters

1. **Delete** `src/server/api/adapters/` (except WebSocket/Metrics)
2. **Delete** `src/pages/api/v1/` endpoints
3. **Move** any unique logic to services

## Migration Plan

### Step 1: Audit REST API Usage (Week 1)
- Identify any external consumers of REST API
- Document unique REST-only features
- Create migration guide for API consumers

### Step 2: Enhance tRPC Coverage (Week 2)
- Add any missing tRPC procedures
- Ensure feature parity with REST
- Add OpenAPI plugin if REST compatibility needed

### Step 3: Migrate Business Logic (Week 3)
- Move adapter logic to services
- Update tRPC to use services
- Test thoroughly

### Step 4: Deprecate REST (Week 4)
- Add deprecation warnings to REST endpoints
- Update documentation
- Provide migration timeline

### Step 5: Remove REST (Week 5)
- Delete REST endpoints
- Delete API adapters
- Clean up unused code

## Benefits of Consolidation

### Quantitative Benefits
- **Code Reduction**: ~40% less API code
- **File Reduction**: Remove ~30 API files
- **Type Safety**: 100% type-safe API calls
- **Bundle Size**: Smaller client bundle (no REST client)

### Qualitative Benefits
- **Single Source of Truth**: One implementation per operation
- **Better DX**: Auto-completion and type inference
- **Simpler Auth**: Single auth pattern
- **Easier Testing**: Test procedures directly

## Risk Assessment

### Risks
1. **External API Consumers**: May rely on REST endpoints
2. **Breaking Changes**: REST to tRPC migration
3. **Learning Curve**: Developers need tRPC knowledge

### Mitigations
1. **OpenAPI Plugin**: Generate REST-compatible endpoints from tRPC
2. **Gradual Migration**: Deprecate before removing
3. **Documentation**: Comprehensive tRPC guides

## Comparison: REST vs tRPC

| Aspect | REST API | tRPC | Winner |
|--------|----------|------|--------|
| Type Safety | Manual | Automatic | tRPC ✅ |
| Bundle Size | Larger | Smaller | tRPC ✅ |
| External Access | Easy | Needs adapter | REST ✅ |
| Developer Experience | Manual | Automatic | tRPC ✅ |
| Authentication | Custom | Built-in | tRPC ✅ |
| Error Handling | Manual | Automatic | tRPC ✅ |
| Testing | Complex | Simple | tRPC ✅ |

## Recommended Architecture

```
┌─────────────────┐
│  UI Components  │
└────────┬────────┘
         │ tRPC Client
         ↓
┌─────────────────┐
│  tRPC Routers   │ ← Single API Layer
└────────┬────────┘
         │ Direct calls
         ↓
┌─────────────────┐
│    Services     │ ← Business Logic
└────────┬────────┘
         │ Prisma
         ↓
┌─────────────────┐
│    Database     │
└─────────────────┘

Removed:
❌ REST API Endpoints
❌ API Adapters
❌ Duplicate validation
❌ Manual type conversions
```

## Conclusion

The Server layer's REST API and adapter system is **completely redundant** with tRPC, which is already the primary API (142 files using). Consolidating to tRPC-only will:

1. **Reduce code by 40%** (remove ~30 files)
2. **Improve type safety** (100% inference)
3. **Simplify architecture** (single API pattern)
4. **Better developer experience** (auto-completion)

The REST API exists only for legacy/compatibility reasons and should be deprecated in favor of tRPC, which is already the de facto standard in the codebase.

## Next Steps

1. **Immediate**: Audit REST API usage for external consumers
2. **Short-term**: Stop adding new REST endpoints
3. **Medium-term**: Migrate all operations to tRPC
4. **Long-term**: Remove REST layer entirely

---

*This consolidation aligns with the project's goal of using Prisma types directly and avoiding unnecessary abstraction layers.*