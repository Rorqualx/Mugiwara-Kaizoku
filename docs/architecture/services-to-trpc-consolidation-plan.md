# Services Layer to tRPC Consolidation Plan

*Status: Active*  
*Author: Architecture Team*  
*Date: January 2025*  
*Canonical: Yes*

## Executive Summary

The `src/services/` layer contains duplicate functionality that's already implemented in tRPC routers and server services. This analysis shows how to consolidate the services layer into the existing tRPC architecture, eliminating duplication and simplifying the codebase.

## Current State Analysis

### Services Layer Contents

| Service File | Status | Usage | Duplicate Of |
|-------------|--------|-------|--------------|
| `manga.service.ts` | **DEAD CODE** | 0 imports | `trpc/routers/manga.ts` |
| `eventService.ts` | **DUPLICATE** | Used by some files | `server/services/events/eventService.ts` |
| `clientThemeService.ts` | **CLIENT-SIDE** | UI theme management | Unique functionality |
| `themeConfigService.ts` | **CLIENT-SIDE** | Theme configuration | Unique functionality |
| `patternLearningEngine.ts` | **UNIQUE** | Pattern detection | No duplicate |

### Subdirectories Analysis

| Directory | Contents | Usage | Action Needed |
|-----------|----------|-------|---------------|
| `services/reader/` | Archive handlers | Used by reader UI | Keep (unique) |
| `services/kapowarr/` | Kapowarr integration | Used by server | Move to server layer |
| `services/notifications/` | Notification providers | **DUPLICATE** | Delete (use API layer) |
| `services/search/` | Search service | Used by UI | Consolidate with tRPC |
| `services/status/` | Status service | Unknown usage | Investigate |

## Key Findings

### 1. Dead Code
- **`manga.service.ts`**: 0 imports, completely unused
- Creates its own PrismaClient instance (anti-pattern)
- Duplicates functionality in `trpc/routers/manga.ts`

### 2. Duplicate Implementations
- **Event Service**: Two implementations
  - `src/services/eventService.ts` (client)
  - `src/server/services/events/eventService.ts` (server)
  - Both doing the same thing with Prisma

### 3. Notification Duplication (Triple!)
- `src/api/notifications/adapters/` - API layer
- `src/services/notifications/providers/` - Services layer
- `src/server/services/notifications/` - Server layer
- Same providers implemented 3 times

### 4. tRPC Already Handles Data Layer
- 38 tRPC routers covering all domains
- 142 files using tRPC directly
- Services layer bypasses tRPC, creating parallel data paths

## Architecture Problems

### 1. Multiple PrismaClient Instances
```typescript
// Anti-pattern in services/manga.service.ts
export class MangaService {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient(); // ❌ Creates new instance
  }
}
```

### 2. Parallel Data Paths
```
Current (Confusing):
UI → Services Layer → Prisma
UI → tRPC → Server Services → Prisma

Should be:
UI → tRPC → Server Services → Prisma (single path)
```

### 3. Client-Side Database Access Attempt
Services in `src/services/` trying to use Prisma directly (impossible in browser)

## Consolidation Strategy

### Phase 1: Remove Dead Code (Immediate)

```bash
# Dead files to delete immediately
rm src/services/manga.service.ts  # 0 imports, unused
```

### Phase 2: Consolidate Event Service

**Current Duplication:**
- `src/services/eventService.ts`
- `src/server/services/events/eventService.ts`

**Action:** Delete client version, use tRPC router:
```typescript
// Instead of: new EventService().logEvent()
// Use: trpc.events.log.mutate()
```

### Phase 3: Notification System Consolidation

**Keep:** `src/api/notifications/adapters/` (most complete)
**Delete:** 
- `src/services/notifications/providers/`
- Redundant server implementations

**Update imports:**
```typescript
// Before
import { DiscordProvider } from '../services/notifications/providers/discord-provider';

// After  
import { DiscordAdapter } from '../api/notifications/adapters/discordAdapter';
```

### Phase 4: Move Server-Side Services

**Kapowarr Services:**
```bash
# Move to server layer where they belong
mv src/services/kapowarr/* src/server/services/kapowarr/
```

### Phase 5: Client-Side Services Strategy

**Keep These (Client-Only):**
- `clientThemeService.ts` - Browser theme management
- `themeConfigService.ts` - Theme configuration
- `patternLearningEngine.ts` - Client-side pattern detection
- `reader/` directory - Archive handling

**Move to hooks or utils:**
```bash
# Better location for client utilities
mv src/services/clientThemeService.ts src/utils/theme/
mv src/services/themeConfigService.ts src/utils/theme/
```

## Migration Plan

### Step 1: Update All Data Fetching to tRPC
```typescript
// ❌ OLD: Direct service usage
const mangaService = new MangaService();
const manga = await mangaService.getManga(id);

// ✅ NEW: Use tRPC
const manga = await trpc.manga.get.query({ id });
```

### Step 2: Consolidate Service Logic into tRPC Routers
```typescript
// Move service logic into tRPC router
export const mangaRouter = router({
  get: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      // Logic from MangaService.getManga() goes here
      return ctx.prisma.manga.findUnique({
        where: { id: input.id },
        include: { chapters: true, metadata: true }
      });
    })
});
```

### Step 3: Update Component Imports
```typescript
// Component using services
// ❌ OLD
import { EventService } from '../services/eventService';
const service = new EventService();

// ✅ NEW
import { trpc } from '../utils/trpc-client';
const { mutate } = trpc.events.log.useMutation();
```

## Benefits of Consolidation

### 1. Simplified Architecture
- Single data path: UI → tRPC → Server
- No confusion about which service to use
- Clear client/server boundaries

### 2. Performance Improvements
- Single PrismaClient instance
- Reduced bundle size (remove duplicate code)
- Better caching with tRPC

### 3. Type Safety
- tRPC provides end-to-end type safety
- No manual type syncing between layers
- Auto-completion in IDEs

### 4. Maintainability
- One place to update business logic
- Consistent error handling
- Easier testing

## Implementation Timeline

| Week | Phase | Actions | Impact |
|------|-------|---------|--------|
| 1 | Dead Code | Remove unused files | -5 files |
| 1 | Events | Consolidate event services | -1 duplicate |
| 2 | Notifications | Single notification layer | -15 files |
| 2 | Server Services | Move Kapowarr to server | Better organization |
| 3 | Client Utils | Reorganize client services | Clear boundaries |
| 3 | Testing | Verify all functionality | Ensure stability |

## Risk Mitigation

### Low Risk Items
- Removing `manga.service.ts` (0 imports)
- Moving Kapowarr services (clear server-side)

### Medium Risk Items  
- Event service consolidation (update imports)
- Notification consolidation (many imports to update)

### Mitigation Strategy
1. Start with dead code removal
2. Update one service at a time
3. Run tests after each change
4. Keep backups of removed code

## Success Metrics

### Quantitative
- **File Reduction**: Remove ~20 duplicate files
- **Import Simplification**: Single import path per feature
- **Bundle Size**: 15-20% reduction
- **Code Lines**: ~2000 lines removed

### Qualitative
- Clear separation of client/server code
- Single source of truth for each feature
- Improved developer experience
- Faster onboarding

## Conclusion

The services layer is largely redundant with tRPC routers handling the same functionality. By consolidating into tRPC:

1. **Eliminate 20+ duplicate files**
2. **Simplify from 4 layers to 2** (client → tRPC → server)
3. **Improve type safety** with tRPC's end-to-end types
4. **Reduce bundle size** by 15-20%

The migration is low-risk, starting with dead code removal and progressing to active consolidation with clear rollback points.

## Next Steps

1. **Immediate**: Delete `src/services/manga.service.ts` (dead code)
2. **This Week**: Remove `src/integrations/` folder (0 imports)
3. **Next Week**: Begin notification consolidation
4. **Follow**: The phase plan above

---

*This consolidation aligns with the project's goal of using Prisma types directly and maintaining a clean, non-duplicated architecture.*