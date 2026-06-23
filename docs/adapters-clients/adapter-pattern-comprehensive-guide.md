# Adapter Pattern Comprehensive Guide

*Status: Active*
*Canonical: Yes*

## Overview

External services (metadata providers, download/source backends) are integrated
through a small, consistent adapter contract so the rest of the app can talk to
any provider the same way. Every adapter exposes the same methods and returns the
[AsyncResult](../user-guides/asyncresult-pattern-complete-guide.md) pattern.

The real building blocks are intentionally simple:

| Piece | Location | Role |
|---|---|---|
| `IntegrationAdapter<T>` | `src/utils/integration-adapter.ts` | The interface every adapter implements |
| `BaseIntegrationAdapter<T>` | `src/utils/integration-adapter.ts` | Base class with shared defaults (logging, config, status mapping) |
| `BaseIntegrationConfig` | `src/types/config.types.ts` | Base config shape; provider configs extend it |
| `AdapterFactory` | `src/server/adapters/AdapterFactory.ts` | Singleton registry that creates/caches adapters |

> There is **no** `AdapterRegistry`, `BaseMetadataProviderAdapter`,
> `BaseDownloadClientAdapter`, or `AuthenticationAdapter` class — those are not
> part of the codebase. Use the types above.

## The `IntegrationAdapter` interface

Defined in `src/utils/integration-adapter.ts`. Core surface (every method that
performs I/O returns `Promise<AsyncResult<…, Error>>`):

```typescript
export interface IntegrationAdapter<T extends BaseIntegrationConfig = BaseIntegrationConfig> {
  isEnabled(): boolean;
  getSourceInfo(): MetadataSourceInfo;

  // Core lookups
  search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>>;
  getMangaById(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>>;
  getMangaByTitle(title: string): Promise<AsyncResult<IntegrationMangaData, Error>>;
  getChapters(mangaId: string | number, options?: {
    limit?: number; offset?: number; translatedLanguage?: string[];
  }): Promise<AsyncResult<ChapterEntity[], Error>>;
  getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>>;

  // Metadata
  searchManga(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>>;
  updateMangaMetadata(mangaId: string | number): Promise<AsyncResult<void, Error>>;

  // Configuration & lifecycle
  configure(config: Partial<T>): void;
  getConfig(): T;
  dispose(): void;
}
```

The interface also declares optional `getMangaMetadataById?`, `updateAllMangaMetadata?`,
and several `*Async` methods marked `@deprecated` — prefer the non-suffixed methods.

## `BaseIntegrationConfig`

Defined in `src/types/config.types.ts` (the single source of truth for config
types). Provider-specific configs extend it:

```typescript
export interface BaseIntegrationConfig {
  enabled: boolean;
  name?: string;
  id?: string;
  priority?: number;
  timeout?: number;
}

// e.g. ComicVineConfig extends BaseIntegrationConfig { apiKey: string; … }
```

## `BaseIntegrationAdapter`

`BaseIntegrationAdapter<T extends BaseIntegrationConfig>` (in
`src/utils/integration-adapter.ts`) provides default implementations so a
concrete adapter only has to implement the provider-specific lookups:

- `isEnabled()` → `config.enabled !== false`
- `getConfig()` / `configure(partial)` — merge and return config
- `dispose()` — no-op by default
- `getSourceInfo()` — override in the subclass
- Protected helpers: `log(message, error?)`, `createError(message, cause?)`,
  `mapStatus(providerStatus)` (→ `mapToMangaStatus`)

```typescript
export class WikipediaAdapter extends BaseIntegrationAdapter<BaseIntegrationConfig> {
  constructor(config: BaseIntegrationConfig) {
    super(config, 'wikipedia');
  }

  async search(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
    // …provider-specific implementation, returning success({...}) / failure(err)
  }
}
```

### Specialized base classes

Some adapter families have their own bases instead of (or alongside)
`BaseIntegrationAdapter`:

| Base | Location | Used by |
|---|---|---|
| `BaseMetadataAdapter` | `src/server/adapters/base-metadata-adapter.ts` | metadata providers |
| `UnifiedBaseAdapter` | `src/server/adapters/UnifiedBaseAdapter.ts` | the `unified-*-adapter` providers |
| `BaseNativeDownloadAdapter` | `src/server/adapters/metadata/baseNativeDownloadAdapter.ts` | native/website downloads |
| `BaseApiAdapter` | `src/server/api/adapters/BaseApiAdapter.ts` | API-style clients |
| `BaseNotificationAdapter` | `src/server/services/notifications/base/BaseNotificationAdapter.ts` | notification providers |

## `AdapterFactory`

`AdapterFactory` (`src/server/adapters/AdapterFactory.ts`) is a singleton that
registers adapter types and creates/caches instances. Built-in registrations
include `anilist`, `comicvine`, `wikipedia`, `suwayomi-v2`, and `website`.
(`fandom` and `native_download` are recognised `AdapterType` values and appear
in `createByProvider`'s mapping, but they are not registered via
`registerDefaultAdapters` and will return `null` until a concrete adapter is
registered.)

```typescript
import { MetadataProvider } from '@prisma/client';
import { AdapterFactory } from '@/server/adapters/AdapterFactory';

const factory = AdapterFactory.getInstance();

// Create by Prisma MetadataProvider enum
const anilist = factory.createByProvider(MetadataProvider.ANILIST);

// Introspection
factory.getRegisteredTypes();        // AdapterType[]
factory.hasAdapter('comicvine');     // boolean
factory.getEnabledAdapters();        // enabled adapters + their config
```

### Registering a custom adapter

```typescript
factory.registerAdapter(
  'my-provider',
  MyProviderAdapter,                 // new (config) => IntegrationAdapter | UnifiedBaseAdapter
  { enabled: true, priority: 5, timeout: 30000 },
  /* singleton */ true,
);
```

## Conventions when adding an adapter

1. Define a config interface extending `BaseIntegrationConfig` in `src/types/config.types.ts`.
2. Implement `IntegrationAdapter<YourConfig>` (extend `BaseIntegrationAdapter` or the
   relevant specialized base) — every I/O method returns `AsyncResult`.
3. Register it with `AdapterFactory` (built-ins are registered in
   `registerDefaultAdapters()`).
4. Never throw across the boundary — return `failure(error)` and let callers branch
   on `isError(result)`.

## Related

- [AsyncResult Pattern](../user-guides/asyncresult-pattern-complete-guide.md)
- [Integration Adapter Pattern](./integration-adapter-pattern.md)
- Provider integrations: [ComicVine](./comicvine-integration.md), [Prowlarr](./prowlarr-integration.md)
