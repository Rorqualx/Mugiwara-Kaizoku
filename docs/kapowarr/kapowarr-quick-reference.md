# Kapowarr Quick Reference

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Quick Reference

---
# Kapowarr Integration - Quick Reference

## 🚀 Quick Start

```bash
# Already done - just start coding!
pnpm dev
```

## 📁 File Structure

```
src/
├── types/
│   ├── domain/
│   │   └── kapowarr-types.ts        ✅ Complete
│   └── adapters/
│       └── kapowarr.ts              ✅ Complete
├── components/
│   ├── settings/kapowarr/           ✅ Complete
│   │   ├── KapowarrSettings.tsx
│   │   ├── KapowarrSourceList.tsx
│   │   ├── AddKapowarrSource.tsx
│   │   ├── KapowarrDownloads.tsx
│   │   ├── WebsiteInspector.tsx
│   │   └── SelectorBuilder.tsx
│   └── manga/kapowarr/              ✅ Complete
│       ├── KapowarrSearch.tsx
│       └── KapowarrMangaDetails.tsx
├── api/metadataProviders/           🔵 TODO
│   ├── adapters/
│   │   └── baseKapowarrAdapter.ts
│   └── scrapers/
│       └── WebScraper.ts
├── server/routers/                  🔵 TODO
│   └── kapowarr.ts
└── services/kapowarr/               🔵 TODO
    └── KapowarrManager.ts
```

## 🎯 Next Implementation Steps

### Step 1: Create Web Scraper (Phase 2)
```typescript
// src/api/metadataProviders/scrapers/WebScraper.ts
import * as cheerio from 'cheerio';

export class WebScraper {
  async fetchPage(url: string): Promise<string> {
    // Implementation
  }
  
  async extractSearchResults(html: string): Promise<MangaSearchResult[]> {
    const $ = cheerio.load(html);
    // Use selectors from config
  }
}
```

### Step 2: Create tRPC Router (Phase 3)
```typescript
// src/server/routers/kapowarr.ts
export const kapowarrRouter = router({
  getSources: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.kapowarrSource.findMany();
  }),
  
  addSource: publicProcedure
    .input(z.object({
      name: z.string(),
      baseUrl: z.string().url(),
      config: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    })
});
```

### Step 3: Update Components
Remove placeholder data and connect to tRPC:
```typescript
// Before (current)
const sourcesQuery = {
  data: [] as Array<...>,
  // ...placeholder
};

// After
const sourcesQuery = trpc.kapowarr.getSources.useQuery();
```

## 🛠️ Key Patterns to Follow

### AsyncResult Pattern
```typescript
async function operation(): Promise<AsyncResult<Data, Error>> {
  try {
    const result = await doSomething();
    return createSuccessResult(result);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
```

### Type Guards
```typescript
function isValidSelector(obj: unknown): obj is SelectorConfig {
  if (!obj || typeof obj !== 'object') return false;
  const config = obj as Record<string, unknown>;
  return (
    (typeof config.css === 'string' || typeof config.xpath === 'string') &&
    ['text', 'attribute', 'html'].includes(config.extract as string)
  );
}
```

### ID Conversion
```typescript
import { toNumberId } from '@/utils/id-converters';

// Always convert IDs when passing to Prisma
await ctx.prisma.manga.findUnique({
  where: { id: toNumberId(mangaId) }
});
```

## 📋 Checklist Before Committing

- [ ] `pnpm type-check` passes
- [ ] No `any` types
- [ ] Enums use UPPERCASE
- [ ] Relative imports
- [ ] AsyncResult for async ops
- [ ] Type guards for external data
- [ ] Error handling with instanceof

## 🔗 Useful Commands

```bash
# Type check
pnpm type-check

# Generate Prisma client
pnpm prisma generate

# Run dev server
pnpm dev

# Build (only approved command)
pnpm build:clean
```

## 📚 Key Documentation

- [Full Implementation Plan](./kapowarr-implementation-plan.md)
- [Developer Guide](./kapowarr-developer-guide.md)
- [Architecture Guidelines](./architectural-audit.md)
- [AsyncResult Pattern](./asyncresult-pattern-complete-guide.md)

## ⚡ Quick Wins

1. **Test the UI**: Components are ready, navigate to Settings → Kapowarr
2. **Review Types**: Check `/src/types/domain/kapowarr-types.ts`
3. **Understand Flow**: Follow the search → details → download flow
4. **Check Standards**: All code follows Mugiwara-Kaizoku patterns

## 🎉 Ready to Code!

The foundation is solid. Start with Phase 2 (Web Scraper) and work your way through. All UI is ready and waiting for the backend implementation.
