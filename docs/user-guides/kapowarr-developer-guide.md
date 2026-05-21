# Kapowarr Developer Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Developer Guide

---
# Kapowarr Native Downloader - Developer Guide

## Overview

This guide provides step-by-step instructions for developers to continue implementing the Kapowarr Native Downloader integration in Mugiwara-Kaizoku.

## Current Status

✅ **Completed:**
- Phase 1: Core Types & Domain Models
- Phase 4: UI Components

🔵 **Remaining:**
- Phase 2: Base Infrastructure
- Phase 3: tRPC Integration
- Phase 5: Services & Background Jobs
- Phase 6: Integration & Migration
- Phase 7: Testing & Documentation
- Phase 8: Deployment & Monitoring

## Quick Start

### Prerequisites
- Node.js and pnpm installed
- PostgreSQL database running
- Understanding of Mugiwara-Kaizoku architecture

### Setup
```bash
# Generate Prisma client (already includes Kapowarr models)
pnpm prisma generate

# Start development server
pnpm dev

# Type check
pnpm type-check
```

## Phase 2: Base Infrastructure Implementation

### 2.1 Create Base Kapowarr Adapter

Create `/src/api/metadataProviders/adapters/baseKapowarrAdapter.ts`:

```typescript
import { BaseIntegrationAdapter } from '../base/BaseIntegrationAdapter';
import { IntegrationAdapter } from '../../../types/adapters/base';
import { AsyncResult, createSuccessResult, createErrorResult, isSuccess, isError } from '../../../utils/async-result';
import { KapowarrProviderConfig } from '../../../types/adapters/kapowarr';
import { MangaSearchResult } from '../../../types/domain/manga-types';
import { WebScraper } from '../scrapers/WebScraper';

export abstract class BaseKapowarrAdapter<TConfig extends KapowarrProviderConfig> 
  extends BaseIntegrationAdapter<TConfig> 
  implements IntegrationAdapter<TConfig> {
  
  protected scraper: WebScraper;
  
  constructor(config: TConfig) {
    super(config);
    this.scraper = new WebScraper(config);
  }
  
  // Implement all abstract methods...
}
```

### 2.2 Create Web Scraper Engine

Create `/src/api/metadataProviders/scrapers/WebScraper.ts`:

```typescript
import * as cheerio from 'cheerio';
import { HttpClient } from '../../base/HttpClient';
import { KapowarrProviderConfig, SelectorConfig } from '../../../types/adapters/kapowarr';

export class WebScraper {
  private http: HttpClient;
  private config: KapowarrProviderConfig;
  
  constructor(config: KapowarrProviderConfig) {
    this.config = config;
    this.http = new HttpClient({
      baseURL: config.baseUrl,
      headers: config.headers,
      timeout: 30000
    });
  }
  
  // Implement scraping methods...
}
```

### 2.3 Create Converters

Create `/src/utils/converters/kapowarr-converters.ts`:

```typescript
import { BaseConverter } from './base-converter';
import { KapowarrSource, KapowarrDownload } from '../../types/domain/kapowarr-types';
import { KapowarrSource as PrismaKapowarrSource } from '@prisma/client';

export class KapowarrSourceConverter extends BaseConverter<PrismaKapowarrSource, KapowarrSource> {
  convert(source: PrismaKapowarrSource): KapowarrSource {
    return {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      status: source.status,
      config: this.parseJsonSafely(source.config),
      enabled: source.enabled,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    };
  }
}
```

## Phase 3: tRPC Integration

### 3.1 Create Kapowarr Router

Create `/src/server/routers/kapowarr.ts`:

```typescript
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { toNumberId } from '../../utils/id-converters';
import { KapowarrSourceConverter } from '../../utils/converters/kapowarr-converters';

export const kapowarrRouter = router({
  // Get all sources
  getSources: publicProcedure
    .query(async ({ ctx }) => {
      const sources = await ctx.prisma.kapowarrSource.findMany({
        orderBy: { name: 'asc' }
      });
      
      const converter = new KapowarrSourceConverter();
      return sources.map(source => converter.convert(source));
    }),
  
  // Add more procedures...
});
```

### 3.2 Update Main Router

Edit `/src/server/routers/_app.ts`:

```typescript
import { kapowarrRouter } from './kapowarr';

export const appRouter = router({
  // ... existing routers
  kapowarr: kapowarrRouter,
});
```

## Phase 5: Services Implementation

### 5.1 Create Kapowarr Manager

Create `/src/services/kapowarr/KapowarrManager.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { WebsiteProviderAdapter } from '../../api/metadataProviders/adapters/websiteProviderAdapter';
import { AsyncResult, createSuccessResult, createErrorResult } from '../../utils/async-result';

export class KapowarrManager {
  private prisma: PrismaClient;
  private adapters: Map<string, WebsiteProviderAdapter> = new Map();
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  // Implement manager methods...
}
```

## Code Standards Checklist

### Before Committing

- [ ] Run `pnpm type-check` - must pass
- [ ] No `any` types without type guards
- [ ] All enums use UPPERCASE values
- [ ] Use relative imports (not aliases)
- [ ] Use `toNumberId()` for ID conversions
- [ ] Use AsyncResult pattern for async operations
- [ ] Check `isPending` not `isLoading`
- [ ] Use `fw` not `weight` (Mantine v7)
- [ ] Use `gap` not `spacing` (Mantine v7)

### Error Handling Pattern

```typescript
try {
  const result = await operation();
  return createSuccessResult(result);
} catch (error) {
  return createErrorResult(
    error instanceof Error ? error : new Error(String(error))
  );
}
```

### Type Guard Pattern

```typescript
function isValidData(obj: unknown): obj is MyType {
  if (!obj || typeof obj !== 'object') return false;
  
  const data = obj as Record<string, unknown>;
  
  return (
    typeof data.id === 'string' &&
    typeof data.name === 'string'
    // ... more checks
  );
}
```

## Testing

### Unit Tests

Create test files alongside components:

```typescript
// src/api/metadataProviders/adapters/__tests__/websiteProviderAdapter.test.ts
import { WebsiteProviderAdapter } from '../websiteProviderAdapter';

describe('WebsiteProviderAdapter', () => {
  // Test implementation...
});
```

### Integration Tests

```typescript
// src/server/routers/__tests__/kapowarr.test.ts
import { createInnerTRPCContext } from '../../trpc';
import { appRouter } from '../_app';

describe('kapowarr router', () => {
  // Test implementation...
});
```

## Common Issues & Solutions

### Issue: TypeScript errors for missing tRPC procedures
**Solution**: Implement the tRPC router first (Phase 3)

### Issue: Cheerio type errors
**Solution**: Use proper cheerio types:
```typescript
import { CheerioAPI, Element } from 'cheerio';
```

### Issue: Prisma enum mismatch
**Solution**: Always use UPPERCASE enum values

### Issue: Component not rendering
**Solution**: Check Next.js router usage and imports

## Resources

- [Mugiwara-Kaizoku Architecture](./architectural-audit.md)
- [AsyncResult Pattern](./asyncresult-pattern-complete-guide.md)
- [Adapter Pattern](./adapter-pattern-unified.md)
- [TypeScript Guidelines](./typescript-configuration-guide.md)

## Support

For questions or issues:
1. Check existing documentation
2. Review similar implementations (AniList, MangaDex adapters)
3. Follow established patterns
4. Maintain code quality standards
