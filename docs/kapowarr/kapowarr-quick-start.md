# Kapowarr Quick Start

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Quick Start

---
# Kapowarr Integration Quick Start Guide

## Overview

This guide helps developers quickly understand and continue the Kapowarr Native Downloader integration for Mugiwara-Kaizoku.

## Current Status

✅ **Completed**: Phase 1 (Types) and Phase 4 (UI Components)  
⏳ **Next**: Phase 2 (Base Infrastructure) → Phase 3 (tRPC) → Phase 5 (Services)

## Project Structure

```
src/
├── types/
│   ├── domain/kapowarr-types.ts      ✅ Domain models
│   └── adapters/kapowarr.ts          ✅ Adapter interfaces
├── components/
│   ├── settings/kapowarr/            ✅ Settings UI
│   └── manga/kapowarr/               ✅ Search UI
├── api/metadataProviders/
│   ├── adapters/                     ⏳ Need base adapter
│   └── scrapers/                     ⏳ Need web scraper
├── server/routers/
│   └── kapowarr.ts                   ⏳ Need tRPC router
└── services/kapowarr/                ⏳ Need manager service
```

## Quick Implementation Guide

### Step 1: Create Base Kapowarr Adapter (Phase 2)

```typescript
// src/api/metadataProviders/adapters/baseKapowarrAdapter.ts
import { BaseIntegrationAdapter } from '../base/BaseIntegrationAdapter';
import { AsyncResult, createSuccessResult, createErrorResult } from '../../../utils/async-result';

export abstract class BaseKapowarrAdapter extends BaseIntegrationAdapter {
  // Implement base adapter following the pattern
}
```

### Step 2: Create Web Scraper (Phase 2)

```typescript
// src/api/metadataProviders/scrapers/WebScraper.ts
import * as cheerio from 'cheerio';

export class WebScraper {
  async fetchPage(url: string): Promise<string> {
    // Implement page fetching
  }
  
  async extractSearchResults(html: string): Promise<MangaSearchResult[]> {
    // Implement extraction logic
  }
}
```

### Step 3: Create tRPC Router (Phase 3)

```typescript
// src/server/routers/kapowarr.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const kapowarrRouter = router({
  getSources: publicProcedure.query(async ({ ctx }) => {
    // Implement source fetching
  }),
  
  addSource: publicProcedure
    .input(z.object({
      name: z.string(),
      baseUrl: z.string().url(),
      config: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      // Implement source creation
    })
});
```

### Step 4: Update App Router

```typescript
// src/server/routers/_app.ts
import { kapowarrRouter } from './kapowarr';

export const appRouter = router({
  // ... existing routers
  kapowarr: kapowarrRouter,
});
```

## Key Implementation Rules

### 1. Always Use AsyncResult Pattern

```typescript
// ❌ Wrong
async function search(query: string): Promise<SearchResult[]> {
  try {
    return await doSearch(query);
  } catch (error) {
    throw error;
  }
}

// ✅ Correct
async function _search(query: string): Promise<AsyncResult<SearchResult[], Error>> {
  try {
    const results = await doSearch(query);
    return createSuccessResult(results);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
```

### 2. Follow Enum Standards

```typescript
// All enums use UPPERCASE string values
enum KapowarrSourceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR'
}

// Direct usage with Prisma (no casting)
await prisma.kapowarrSource.create({
  data: {
    status: KapowarrSourceStatus.ACTIVE // ✅ No casting needed
  }
});
```

### 3. Type Safety First

```typescript
// Always validate external data
function isValidSearchResult(data: unknown): data is MangaSearchResult {
  if (!data || typeof data !== 'object') return false;
  // ... validate all required fields
}

// Use type guards before processing
const results = externalData.filter(isValidSearchResult);
```

### 4. Error Handling

```typescript
// Always provide context in errors
try {
  // operation
} catch (error) {
  logger.error('Operation failed', {
    context: { sourceId, mangaId },
    error: error instanceof Error ? error.message : String(error)
  });
  
  return createErrorResult(
    new Error(`Failed to process manga ${mangaId}: ${error}`)
  );
}
```

## Testing the Integration

### 1. Test UI Components

```bash
# Start development server
pnpm dev

# Navigate to settings
http://localhost:3000/settings/kapowarr
```

### 2. Test Type Checking

```bash
# Run type check
pnpm type-check

# Should pass with no errors
```

### 3. Test Build

```bash
# Use the ONLY approved build command
pnpm build:clean
```

## Common Pitfalls to Avoid

1. **Don't use `any` types** - Always define proper interfaces
2. **Don't skip validation** - Always validate external data
3. **Don't use string literals for enums** - Use the enum constants
4. **Don't create `.fixed.ts` files** - Modify originals directly
5. **Don't use aliases** - Use relative imports

## Helpful Resources

- **Adapter Pattern**: See existing adapters in `src/api/metadataProviders/adapters/`
- **AsyncResult Pattern**: See `src/utils/async-result.ts`
- **tRPC Examples**: See existing routers in `src/server/routers/`
- **UI Patterns**: See existing settings components

## Environment Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client (after schema changes)
pnpm generate

# Start dev server
pnpm dev
```

## Need Help?

1. Check `/docs/CLAUDE.md` for project guidelines
2. Review `/docs/architectural-audit.md` for patterns
3. Look at existing implementations for examples
4. Follow TypeScript errors - they guide you!

## Next Developer TODO

1. [ ] Create `BaseKapowarrAdapter` in `src/api/metadataProviders/adapters/`
2. [ ] Create `WebScraper` in `src/api/metadataProviders/scrapers/`
3. [ ] Create `kapowarrRouter` in `src/server/routers/`
4. [ ] Add router to `_app.ts`
5. [ ] Test with UI components

Remember: The UI is ready and waiting for the backend! 🚀
