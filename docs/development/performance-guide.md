# Performance Optimization Guide

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-11-03*

## Overview

This guide covers performance optimization strategies specific to the Mugiwara Kaizoku project, including database queries, caching, React optimization, and API performance.

---

## Database Performance

### Query Optimization with Prisma

#### Use `select` to Limit Fields

```typescript
// ❌ BAD - Fetches all fields (including large JSONB columns)
const manga = await prisma.manga.findUnique({
  where: { id }
});

// ✅ GOOD - Only fetch needed fields
const manga = await prisma.manga.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    status: true,
    coverImage: true,
    // Don't fetch: metadata, rawData, etc.
  }
});
```

#### Use Pagination

```typescript
// ❌ BAD - Fetches all records
const allManga = await prisma.manga.findMany();

// ✅ GOOD - Paginate results
const manga = await prisma.manga.findMany({
  take: 25,           // Limit to 25 records
  skip: page * 25,    // Skip previous pages
  orderBy: { createdAt: 'desc' }
});
```

#### Use Indexes for Frequently Queried Fields

```prisma
// schema.prisma
model Manga {
  id        Int    @id @default(autoincrement())
  title     String @db.Text
  slug      String @unique  // Automatically indexed
  status    MangaStatus

  @@index([status])           // Index for filtering by status
  @@index([createdAt])        // Index for sorting by date
  @@index([title(sort: Desc)]) // Index for title searches
}
```

#### Batch Operations

```typescript
// ❌ BAD - N+1 queries (one per manga)
for (const manga of mangaList) {
  const chapters = await prisma.chapter.findMany({
    where: { mangaId: manga.id }
  });
}

// ✅ GOOD - Single query with relation
const mangaWithChapters = await prisma.manga.findMany({
  include: {
    chapters: {
      take: 10,
      orderBy: { chapterNumber: 'desc' }
    }
  }
});
```

---

## Caching Strategy

### Redis-like UNLOGGED Tables

The project uses PostgreSQL UNLOGGED tables for high-performance caching.

#### CacheUnified Table

```typescript
// Hot cache for frequently accessed data (model `cache_unified`, snake_case columns)
await prisma.cache_unified.upsert({
  where: { cache_key: `manga:${id}` },
  create: {
    cache_key: `manga:${id}`,
    cache_value: mangaData,                          // Json column
    expires_at: new Date(Date.now() + 3600000)       // 1 hour TTL
  },
  update: {
    cache_value: mangaData,
    expires_at: new Date(Date.now() + 3600000)
  }
});

// Retrieve from cache
const cached = await prisma.cache_unified.findUnique({
  where: { cache_key: `manga:${id}` }
});

if (cached && cached.expires_at && cached.expires_at > new Date()) {
  return cached.cache_value;
}
```

#### TTL-Based Cache Invalidation

```typescript
// Set cache with TTL
function setCacheWithTTL<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  return prisma.cache_unified.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(value),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    },
    update: {
      value: JSON.stringify(value),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    }
  });
}

// Get from cache with expiration check
async function getCacheWithTTL<T>(key: string): Promise<T | null> {
  const cached = await prisma.cache_unified.findUnique({
    where: { key }
  });

  if (!cached || cached.expiresAt <= new Date()) {
    return null;
  }

  return JSON.parse(cached.value) as T;
}
```

#### Cache Invalidation on Mutations

```typescript
// Invalidate cache after update
async function updateManga(id: number, data: UpdateMangaInput) {
  const updated = await prisma.manga.update({
    where: { id },
    data
  });

  // Invalidate related caches
  await prisma.cache_unified.deleteMany({
    where: {
      key: {
        in: [
          `manga:${id}`,
          `manga:${id}:chapters`,
          `user:${userId}:library`
        ]
      }
    }
  });

  return updated;
}
```

#### Cache Namespaces

```typescript
// Organize caches by namespace
const CacheKeys = {
  manga: (id: number) => `manga:${id}`,
  mangaChapters: (id: number) => `manga:${id}:chapters`,
  userLibrary: (userId: number) => `user:${userId}:library`,
  search: (query: string) => `search:${query}`,
  trending: () => `trending:manga`
};

// Use namespaced keys
await setCacheWithTTL(
  CacheKeys.manga(123),
  mangaData,
  3600 // 1 hour
);

await setCacheWithTTL(
  CacheKeys.trending(),
  trendingManga,
  300 // 5 minutes
);
```

---

## React Performance

### Component Optimization

#### Memoization with React.memo

```typescript
// ❌ BAD - Re-renders on every parent render
export function MangaCard({ manga }: MangaCardProps) {
  return <Card>{manga.title}</Card>;
}

// ✅ GOOD - Only re-renders when manga changes
export const MangaCard = React.memo(function MangaCard({ manga }: MangaCardProps) {
  return <Card>{manga.title}</Card>;
});
```

#### useMemo for Expensive Computations

```typescript
// ❌ BAD - Recalculates on every render
function MangaList({ manga }: Props) {
  const sorted = manga.sort((a, b) => b.rating - a.rating);
  return <>{sorted.map(m => <MangaCard key={m.id} manga={m} />)}</>;
}

// ✅ GOOD - Only recalculates when manga changes
function MangaList({ manga }: Props) {
  const sorted = useMemo(
    () => manga.sort((a, b) => b.rating - a.rating),
    [manga]
  );
  return <>{sorted.map(m => <MangaCard key={m.id} manga={m} />)}</>;
}
```

#### useCallback for Event Handlers

```typescript
// ❌ BAD - New function on every render
function MangaList({ onSelect }: Props) {
  return <MangaCard onClick={() => onSelect(manga)} />;
}

// ✅ GOOD - Stable function reference
function MangaList({ onSelect }: Props) {
  const handleClick = useCallback(
    () => onSelect(manga),
    [manga, onSelect]
  );
  return <MangaCard onClick={handleClick} />;
}
```

### Virtual Scrolling for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function MangaList({ manga }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: manga.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated item height
    overscan: 5               // Render 5 extra items
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <MangaCard
            key={manga[virtualItem.index].id}
            manga={manga[virtualItem.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### Image Optimization

```typescript
// ✅ Use Next.js Image component
import Image from 'next/image';

function MangaCover({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={300}
      height={450}
      placeholder="blur"
      blurDataURL="/placeholder.jpg"
      loading="lazy"           // Lazy load images
      quality={80}             // Reduce quality slightly
      sizes="(max-width: 768px) 100vw, 300px"
    />
  );
}
```

---

## API Performance

### tRPC Query Optimization

#### Enable Query Batching

```typescript
// src/utils/trpc-client.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      maxURLLength: 2083,
      // Batches multiple queries into single HTTP request
    })
  ]
});
```

#### Use React Query Caching

```typescript
// Configure caching in tRPC client
export const trpc = createTRPCReact<AppRouter>();

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,      // 1 minute
          gcTime: 5 * 60 * 1000,  // 5 minutes
          refetchOnWindowFocus: false
        }
      }
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <Component {...pageProps} />
    </trpc.Provider>
  );
}
```

#### Prefetch Queries

```typescript
// Prefetch on hover
function MangaCard({ manga }: Props) {
  const utils = trpc.useUtils();

  const handleHover = () => {
    utils.manga.getById.prefetch({ id: manga.id });
  };

  return (
    <Card onMouseEnter={handleHover}>
      <Link href={`/manga/${manga.id}`}>
        {manga.title}
      </Link>
    </Card>
  );
}
```

### Parallel Requests

```typescript
// ❌ BAD - Sequential requests
const manga = await trpc.manga.getById.query({ id: 1 });
const chapters = await trpc.chapter.getByMangaId.query({ mangaId: 1 });
const reviews = await trpc.review.getByMangaId.query({ mangaId: 1 });

// ✅ GOOD - Parallel requests
const [manga, chapters, reviews] = await Promise.all([
  trpc.manga.getById.query({ id: 1 }),
  trpc.chapter.getByMangaId.query({ mangaId: 1 }),
  trpc.review.getByMangaId.query({ mangaId: 1 })
]);
```

---

## Bundle Size Optimization

### Dynamic Imports

```typescript
// ❌ BAD - Loads entire component upfront
import { HeavyEditor } from '@/components/HeavyEditor';

// ✅ GOOD - Load on demand
const HeavyEditor = dynamic(
  () => import('@/components/HeavyEditor'),
  {
    loading: () => <Spinner />,
    ssr: false  // Skip SSR for client-only components
  }
);
```

### Tree Shaking

```typescript
// ❌ BAD - Imports entire library
import _ from 'lodash';

// ✅ GOOD - Import specific functions
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
```

---

## Monitoring Performance

### Measure Component Render Time

```typescript
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  if (actualDuration > 16) { // > 1 frame (60fps)
    logger.warn('Slow render detected', {
      component: id,
      phase,
      duration: actualDuration
    });
  }
}

function App() {
  return (
    <Profiler id="MangaList" onRender={onRenderCallback}>
      <MangaList />
    </Profiler>
  );
}
```

### Database Query Logging

```typescript
// Log slow queries — `$use` middleware was removed in Prisma 5+; use a `$extends` query component
const slowQueryThreshold = 100; // ms

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const before = Date.now();
        const result = await query(args);
        const duration = Date.now() - before;

        if (duration > slowQueryThreshold) {
          logger.warn('Slow query detected', { model, operation, duration });
        }

        return result;
      }
    }
  }
});
```

---

## Performance Checklist

### Before Deploying

- [ ] Database indexes on frequently queried columns
- [ ] Pagination on all list endpoints
- [ ] Image optimization (WebP, lazy loading)
- [ ] Bundle size under 200KB (gzipped)
- [ ] Cache TTL configured
- [ ] React.memo on expensive components
- [ ] Virtual scrolling for long lists
- [ ] API query batching enabled
- [ ] Slow query monitoring enabled

---

## Resources

- **React Performance**: https://react.dev/reference/react/memo
- **Prisma Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization
- **Next.js Optimization**: https://nextjs.org/docs/app/building-your-application/optimizing

---

*Last Updated: 2025-11-03*
*Referenced by: CLAUDE.md, architecture-overview.md*
