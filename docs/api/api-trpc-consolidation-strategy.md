# API Layer to tRPC Consolidation Strategy

*Status: Active*  
*Author: Architecture Team*  
*Date: January 2025*  
*Canonical: Yes*

## Executive Summary

Analysis reveals the API layer (`src/api/`) is used by both tRPC routers and directly by pages, creating a fragmented architecture. This document outlines a strategy to consolidate the API layer into tRPC procedures, establishing tRPC as the single interface for all data operations.

## Current Architecture Analysis

### API Layer Usage Patterns

| Component Type | Direct API Usage | tRPC Usage | Files |
|----------------|-----------------|------------|-------|
| UI Components | ❌ None | ✅ 142 files | All use tRPC |
| Pages | ⚠️ 10+ files | ✅ Most files | Mixed approach |
| tRPC Routers | ✅ 30+ files | N/A | Import API layer |
| API Routes | ✅ 58 files | ❌ None | Bypass tRPC |

### Key Findings

1. **Dual Access Patterns**: 
   - UI Components → tRPC → Server Services → API Layer
   - Pages/API Routes → Direct API Layer (bypassing tRPC)

2. **API Route Proliferation**: 
   - 58 API route files in `/pages/api/`
   - Separate v1 API with 10+ endpoints
   - Direct REST endpoints alongside tRPC

3. **Notification System Split**:
   - tRPC router: `src/server/trpc/routers/notifications.ts` imports API layer
   - Direct usage: Settings pages import API notifications directly
   - Duplicate implementations in services layer

4. **Download Clients Architecture**:
   - API Layer: Base client implementations (`TransmissionClient`, `DelugeClient`, etc.)
   - Server Layer: Download manager imports these clients
   - No tRPC procedures for direct download operations

## Problems with Current Architecture

### 1. Inconsistent Data Access
- Some features use tRPC, others use direct API calls
- Same data available through multiple endpoints
- No single source of truth for data operations

### 2. Security & Validation Gaps
- API routes bypass tRPC's built-in validation
- Inconsistent authentication checks
- No unified rate limiting or middleware

### 3. Type Safety Loss
- Direct API calls lose end-to-end type safety
- Manual type definitions for REST endpoints
- tRPC's type inference benefits lost

### 4. Bundle Size Impact
- API client code included in frontend bundle
- Duplicate logic between API routes and tRPC procedures
- Unnecessary HTTP client libraries

## Consolidation Strategy

### Phase 1: Inventory & Classification (Week 1)

#### Classify API Layer Components

| Category | Components | Action | Priority |
|----------|------------|--------|----------|
| **Metadata Adapters** | AniList, ComicVine, Fandom | Move to server-only | High |
| **Download Clients** | Transmission, Deluge, NZBGet | Wrap in tRPC procedures | High |
| **Notification Adapters** | Discord, Email, Slack, etc. | Consolidate to server | High |
| **HTTP Utilities** | HttpClient, rate limiting | Keep as server utilities | Low |

#### Map API Routes to tRPC

| API Route | tRPC Equivalent | Action |
|-----------|-----------------|--------|
| `/api/v1/health` | `system.health` | Create tRPC procedure |
| `/api/v1/metrics/*` | `metrics.*` | Migrate to tRPC |
| `/api/v1/search` | `search.query` | Already exists, remove API |
| `/api/v1/downloads` | `downloads.*` | Create namespace |
| `/api/v1/webhooks` | `webhooks.*` | Create procedures |

### Phase 2: Create tRPC Procedures (Week 2-3)

#### New tRPC Router Structure
```typescript
// src/server/trpc/routers/downloads.ts
export const downloadsRouter = router({
  // Client management
  clients: {
    list: procedure.query(() => listDownloadClients()),
    test: procedure.input(z.object({
      clientId: z.string(),
      config: z.any()
    })).mutation(({ input }) => testClient(input)),
  },
  
  // Download operations
  queue: {
    add: procedure.input(downloadSchema).mutation(({ input }) => addDownload(input)),
    list: procedure.query(() => getQueue()),
    pause: procedure.input(z.string()).mutation(({ input }) => pauseDownload(input)),
    resume: procedure.input(z.string()).mutation(({ input }) => resumeDownload(input)),
    remove: procedure.input(z.string()).mutation(({ input }) => removeDownload(input)),
  },
  
  // Statistics
  stats: procedure.query(() => getDownloadStats()),
});

// src/server/trpc/routers/system.ts (enhanced)
export const systemRouter = router({
  health: procedure.query(() => getHealthStatus()),
  metrics: procedure.query(() => getSystemMetrics()),
  performance: procedure.query(() => getPerformanceMetrics()),
});
```

### Phase 3: Migrate API Layer to Server (Week 3-4)

#### Move Adapters to Server-Only Location
```
src/server/adapters/
├── metadata/
│   ├── anilist.ts      # From api/metadataProviders/adapters/
│   ├── comicvine.ts
│   └── fandom.ts
├── notifications/
│   ├── discord.ts      # From api/notifications/adapters/
│   ├── email.ts
│   └── slack.ts
└── download/
    ├── transmission.ts  # From api/downloadClients/
    ├── deluge.ts
    └── nzbget.ts
```

#### Update Import Paths
```typescript
// Before: Direct API import
import { TransmissionClient } from '../../../api/downloadClients/transmissionClient';

// After: Server-only import
import { TransmissionClient } from '../adapters/download/transmission';
```

### Phase 4: Migrate Frontend Usage (Week 4-5)

#### Convert Direct API Calls to tRPC

**Before:**
```typescript
// src/pages/settings/integrations/notifications.tsx
import { NotificationService } from '../../../api/notifications';

const service = new NotificationService(config);
await service.sendNotification(payload);
```

**After:**
```typescript
// src/pages/settings/integrations/notifications.tsx
import { trpc } from '../../../utils/trpc-client';

const sendNotification = trpc.notifications.send.useMutation();
await sendNotification.mutateAsync(payload);
```

#### Remove API Route Files
```bash
# After migrating to tRPC
rm -rf src/pages/api/v1/
rm src/pages/api/download-clients/
rm src/pages/api/test-search.ts
# etc...
```

### Phase 5: Remove Dead Code (Week 5)

1. **Delete unused API routes** (58 files)
2. **Remove API client code** from frontend bundle
3. **Delete duplicate service implementations**
4. **Clean up unused imports and dependencies**

## Implementation Guidelines

### 1. Server-Only Code
```typescript
// src/server/adapters/metadata/anilist.ts
// Mark as server-only to prevent client bundling
import 'server-only';

export class AniListAdapter {
  // Implementation stays the same
}
```

### 2. tRPC Procedure Pattern
```typescript
// Consistent pattern for all procedures
export const entityRouter = router({
  // Queries (GET operations)
  list: procedure.query(async () => {
    // Use server-side adapters directly
    return await adapter.fetchData();
  }),
  
  // Mutations (POST/PUT/DELETE)
  create: procedure
    .input(createSchema)
    .mutation(async ({ input, ctx }) => {
      // Validation and auth built-in
      return await adapter.create(input);
    }),
});
```

### 3. Type-Safe Client Usage
```typescript
// Automatic type inference
const { data, error } = trpc.entity.list.useQuery();
//     ^--- Fully typed from server
```

## Migration Checklist

### Per Component Migration
- [ ] Identify all direct API imports
- [ ] Create equivalent tRPC procedure
- [ ] Move adapter to server-only location
- [ ] Update all import paths
- [ ] Test functionality
- [ ] Remove old API code
- [ ] Update documentation

### Global Tasks
- [ ] Set up server-only package markers
- [ ] Create tRPC router structure
- [ ] Update authentication middleware
- [ ] Implement rate limiting in tRPC
- [ ] Add monitoring/logging to procedures
- [ ] Update error handling patterns
- [ ] Test end-to-end type safety

## Benefits After Consolidation

### 1. Simplified Architecture
- **Single Interface**: tRPC for all data operations
- **Clear Boundaries**: Server code stays on server
- **No Duplication**: One implementation per feature

### 2. Improved Developer Experience
- **End-to-End Type Safety**: Types flow from server to client
- **Auto-completion**: IDE knows all available procedures
- **Better Errors**: Type errors caught at compile time

### 3. Better Performance
- **Smaller Bundle**: No API client code in frontend
- **Optimized Queries**: tRPC batching and deduplication
- **Efficient Caching**: Built-in React Query integration

### 4. Enhanced Security
- **Unified Auth**: Single authentication layer
- **Input Validation**: Zod schemas on all procedures
- **Rate Limiting**: Centralized in tRPC middleware

## Success Metrics

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| API Route Files | 58 | 0 | -100% |
| API Layer Imports | 47 | 0 | -100% |
| Bundle Size | Baseline | -30% | Smaller frontend |
| Type Coverage | ~70% | 100% | Full type safety |
| Code Duplication | 40% | <5% | Maintainable |

## Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Inventory | Complete component classification |
| 2-3 | tRPC Procedures | All new routers created |
| 3-4 | Server Migration | Adapters moved to server |
| 4-5 | Frontend Migration | All pages using tRPC |
| 5 | Cleanup | Dead code removed |
| 6 | Testing & Docs | Full validation & documentation |

## Risk Mitigation

### Backward Compatibility
- Keep old API routes during migration
- Use feature flags for gradual rollout
- Maintain compatibility layer if needed

### Testing Strategy
- Unit tests for each tRPC procedure
- Integration tests for full flows
- E2E tests for critical paths
- Performance benchmarks

### Rollback Plan
- Git branches for each phase
- Old code kept in archive branch
- Quick revert procedures documented

## Conclusion

Consolidating the API layer into tRPC will:
1. **Eliminate 58 API route files**
2. **Remove 47 direct API imports**
3. **Provide 100% type safety**
4. **Reduce bundle size by ~30%**
5. **Simplify the architecture significantly**

The migration can be done incrementally with minimal risk, resulting in a cleaner, more maintainable codebase that fully leverages tRPC's benefits.

---

*This document is canonical for API to tRPC consolidation strategy.*