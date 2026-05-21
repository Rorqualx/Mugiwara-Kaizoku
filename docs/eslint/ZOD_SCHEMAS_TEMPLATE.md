# Zod Schema Templates for API Responses

**Status:** 🟢 READY TO USE
**Created:** 2025-11-09
**Purpose:** Eliminate `any` types from JSON.parse() and API response handling

---

## Overview

Per project requirements, **ALL API responses** must be validated with Zod schemas. This document provides templates and patterns for common API integrations in the codebase.

### Benefits

- ✅ Runtime validation (catches malformed responses)
- ✅ Type safety (TypeScript types inferred from schemas)
- ✅ Self-documenting (schema shows expected structure)
- ✅ Eliminates `any` types
- ✅ Reduces no-unsafe-assignment violations

---

## Table of Contents

1. [Basic Patterns](#basic-patterns)
2. [Wikipedia API](#wikipedia-api)
3. [NZBGet Client](#nzbget-client)
4. [Transmission/Deluge](#transmissiondeluge)
5. [Suwayomi Adapter](#suwayomi-adapter)
6. [LocalStorage/SessionStorage](#localstoragesessionstorage)
7. [Config/Settings JSON](#configsettings-json)
8. [Helper Functions](#helper-functions)

---

## Basic Patterns

### Pattern 1: Simple JSON.parse()

**Before:**
```typescript
// ❌ Returns any
const data = JSON.parse(jsonString);
```

**After:**
```typescript
// ✅ Validated and typed
import { z } from 'zod';

const DataSchema = z.object({
  id: z.number(),
  name: z.string(),
  active: z.boolean().optional(),
});

type Data = z.infer<typeof DataSchema>;

function parseData(jsonString: string): Data {
  const parsed: unknown = JSON.parse(jsonString);
  return DataSchema.parse(parsed); // Throws if invalid
}

// Or with error handling
function parseDataSafe(jsonString: string): AsyncResult<Data> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = DataSchema.safeParse(parsed);
    if (!result.success) {
      return AsyncResult.err(
        new ValidationError('Invalid data format', {
          cause: result.error
        })
      );
    }
    return AsyncResult.ok(result.data);
  } catch (error) {
    return AsyncResult.err(
      new ValidationError('JSON parse failed', { cause: error })
    );
  }
}
```

### Pattern 2: Axios Response

**Before:**
```typescript
// ❌ data is any
const response = await axios.get(url);
const data = response.data;
```

**After:**
```typescript
// ✅ Typed and validated
import { z } from 'zod';

const ResponseSchema = z.object({
  status: z.string(),
  data: z.array(z.object({
    id: z.number(),
    title: z.string(),
  })),
});

type ApiResponse = z.infer<typeof ResponseSchema>;

async function fetchData(url: string): Promise<AsyncResult<ApiResponse>> {
  try {
    const response = await axios.get<unknown>(url);
    const parsed = ResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return AsyncResult.err(
        new ValidationError('Invalid API response', {
          cause: parsed.error
        })
      );
    }
    return AsyncResult.ok(parsed.data);
  } catch (error) {
    return AsyncResult.err(
      new NetworkError('API request failed', { cause: error })
    );
  }
}
```

---

## Wikipedia API

### Wikipedia Parse Response

**File:** Used in `WikipediaAdapter.ts`

```typescript
import { z } from 'zod';

// Text content wrapper
const WikiTextSchema = z.object({
  '*': z.string(), // Wikipedia wraps HTML in '*' property
});

// Parse result
const WikiParseSchema = z.object({
  title: z.string(),
  pageid: z.number(),
  text: WikiTextSchema,
  images: z.array(z.string()).optional(),
  categories: z.array(z.object({
    '*': z.string(),
    sortkey: z.string().optional(),
  })).optional(),
});

// Full response
const WikipediaParseResponseSchema = z.object({
  parse: WikiParseSchema,
});

type WikipediaParseResponse = z.infer<typeof WikipediaParseResponseSchema>;

// Usage
async function fetchWikipediaPage(title: string): Promise<AsyncResult<WikipediaParseResponse>> {
  try {
    const response = await axios.get<unknown>('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'parse',
        page: title,
        format: 'json',
        prop: 'text|images|categories',
      },
    });

    const result = WikipediaParseResponseSchema.safeParse(response.data);
    if (!result.success) {
      return AsyncResult.err(
        new ValidationError('Invalid Wikipedia response', {
          cause: result.error,
          context: { title }
        })
      );
    }

    return AsyncResult.ok(result.data);
  } catch (error) {
    return AsyncResult.err(
      new NetworkError('Wikipedia API request failed', {
        cause: error,
        context: { title }
      })
    );
  }
}
```

### Wikipedia Search Response

```typescript
const WikiSearchResultSchema = z.object({
  ns: z.number(), // Namespace
  title: z.string(),
  pageid: z.number(),
  snippet: z.string().optional(),
  timestamp: z.string().optional(),
});

const WikipediaSearchResponseSchema = z.object({
  query: z.object({
    search: z.array(WikiSearchResultSchema),
    searchinfo: z.object({
      totalhits: z.number(),
    }).optional(),
  }),
});

type WikipediaSearchResponse = z.infer<typeof WikipediaSearchResponseSchema>;
```

---

## NZBGet Client

### Status Response

**File:** Used in `nzbgetClient.ts`

```typescript
import { z } from 'zod';

const NZBGetStatusSchema = z.object({
  version: z.string(),
  ServerStandBy: z.boolean(),
  DownloadRate: z.number(), // bytes per second
  DownloadLimit: z.number(),
  DownloadPaused: z.boolean(),
  RemainingSizeMB: z.number(),
  DownloadedSizeMB: z.number(),
  UpTimeSec: z.number(),
  ServerTime: z.number(),
  PostPaused: z.boolean(),
  ScanPaused: z.boolean(),
  FreeDiskSpaceMB: z.number(),
});

type NZBGetStatus = z.infer<typeof NZBGetStatusSchema>;
```

### History Response

```typescript
const NZBGetHistoryItemSchema = z.object({
  NZBID: z.number(),
  Name: z.string(),
  Status: z.enum(['SUCCESS', 'FAILURE', 'WARNING', 'DELETED']),
  FileSizeMB: z.number(),
  DownloadedSizeMB: z.number(),
  DownloadTimeSec: z.number(),
  FinalDir: z.string().optional(),
  Category: z.string(),
  ParStatus: z.enum(['NONE', 'SUCCESS', 'FAILURE', 'MANUAL']).optional(),
  UnpackStatus: z.enum(['NONE', 'SUCCESS', 'FAILURE']).optional(),
  HistoryTime: z.number(),
  Parameters: z.array(z.object({
    Name: z.string(),
    Value: z.string(),
  })).optional(),
});

const NZBGetHistoryResponseSchema = z.array(NZBGetHistoryItemSchema);

type NZBGetHistory = z.infer<typeof NZBGetHistoryResponseSchema>;
```

### Download Queue Response

```typescript
const NZBGetQueueItemSchema = z.object({
  NZBID: z.number(),
  NZBName: z.string(),
  Category: z.string(),
  FileSizeMB: z.number(),
  RemainingSizeMB: z.number(),
  DownloadedSizeMB: z.number(),
  Status: z.string(),
  Priority: z.number(),
});

const NZBGetQueueResponseSchema = z.array(NZBGetQueueItemSchema);

type NZBGetQueue = z.infer<typeof NZBGetQueueResponseSchema>;
```

---

## Transmission/Deluge

### Transmission Session Stats

**File:** Used in `transmissionClient.ts`

```typescript
const TransmissionSessionStatsSchema = z.object({
  'activeTorrentCount': z.number(),
  'downloadSpeed': z.number(),
  'pausedTorrentCount': z.number(),
  'torrentCount': z.number(),
  'uploadSpeed': z.number(),
  'cumulative-stats': z.object({
    downloadedBytes: z.number(),
    filesAdded: z.number(),
    secondsActive: z.number(),
    sessionCount: z.number(),
    uploadedBytes: z.number(),
  }).optional(),
});

const TransmissionResponseSchema = z.object({
  result: z.enum(['success', 'failure']),
  arguments: TransmissionSessionStatsSchema,
});

type TransmissionResponse = z.infer<typeof TransmissionResponseSchema>;
```

### Transmission Torrent Get

```typescript
const TransmissionTorrentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.number(), // 0=stopped, 4=downloading, 6=seeding
  percentDone: z.number(), // 0.0 to 1.0
  rateDownload: z.number(), // bytes per second
  rateUpload: z.number(),
  downloadDir: z.string(),
  totalSize: z.number(),
  error: z.number(), // 0=no error
  errorString: z.string(),
  eta: z.number(), // seconds, -1=unknown
  addedDate: z.number(), // unix timestamp
  doneDate: z.number(),
});

const TransmissionTorrentGetResponseSchema = z.object({
  result: z.literal('success'),
  arguments: z.object({
    torrents: z.array(TransmissionTorrentSchema),
  }),
});

type TransmissionTorrentGetResponse = z.infer<typeof TransmissionTorrentGetResponseSchema>;
```

---

## Suwayomi Adapter

### Suwayomi Manga Response

**File:** Used in `suwayomiAdapter.ts`

```typescript
const SuwayomiMangaSchema = z.object({
  id: z.number(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  url: z.string(),
  artist: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  genre: z.array(z.string()),
  status: z.enum(['ONGOING', 'COMPLETED', 'LICENSED', 'PUBLISHING_FINISHED', 'CANCELLED', 'HIATUS', 'UNKNOWN']),
  inLibrary: z.boolean(),
  source: z.object({
    id: z.string(),
    name: z.string(),
    lang: z.string(),
  }),
});

const SuwayomiMangaListResponseSchema = z.array(SuwayomiMangaSchema);

type SuwayomiManga = z.infer<typeof SuwayomiMangaSchema>;
type SuwayomiMangaList = z.infer<typeof SuwayomiMangaListResponseSchema>;
```

### Suwayomi Chapter Response

```typescript
const SuwayomiChapterSchema = z.object({
  id: z.number(),
  url: z.string(),
  name: z.string(),
  uploadDate: z.number(), // unix timestamp
  chapterNumber: z.number(),
  scanlator: z.string().nullable(),
  mangaId: z.number(),
  read: z.boolean(),
  bookmarked: z.boolean(),
  lastPageRead: z.number(),
  pageCount: z.number(),
  downloaded: z.boolean(),
});

const SuwayomiChapterListResponseSchema = z.array(SuwayomiChapterSchema);

type SuwayomiChapter = z.infer<typeof SuwayomiChapterSchema>;
```

---

## LocalStorage/SessionStorage

### User Preferences

**File:** Used in `smartClientSelector.ts`, preference utilities

```typescript
const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.string(),
  readerMode: z.enum(['single', 'double', 'webtoon']).optional(),
  readingDirection: z.enum(['ltr', 'rtl']).optional(),
  autoMarkAsRead: z.boolean().optional(),
  notifications: z.object({
    newChapters: z.boolean(),
    downloads: z.boolean(),
    updates: z.boolean(),
  }).optional(),
});

type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Usage
function loadUserPreferences(): UserPreferences | null {
  const stored = localStorage.getItem('user-preferences');
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    const result = UserPreferencesSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn('Invalid user preferences in localStorage', {
        errors: result.error.errors
      });
      return null;
    }
    return result.data;
  } catch (error) {
    logger.error('Failed to parse user preferences', { error });
    return null;
  }
}

function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem('user-preferences', JSON.stringify(prefs));
  } catch (error) {
    logger.error('Failed to save user preferences', { error });
  }
}
```

### Download Client Selection

```typescript
const DownloadClientConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['transmission', 'deluge', 'sabnzbd', 'nzbget']),
  name: z.string(),
  url: z.string().url(),
  username: z.string().optional(),
  enabled: z.boolean(),
  priority: z.number(),
});

const DownloadClientSelectionSchema = z.object({
  preferredTorrentClient: z.string().optional(),
  preferredUsenetClient: z.string().optional(),
  clients: z.array(DownloadClientConfigSchema),
  lastUpdated: z.string().datetime(),
});

type DownloadClientSelection = z.infer<typeof DownloadClientSelectionSchema>;
```

---

## Config/Settings JSON

### Provider Configuration

**File:** Used in `providerMigration.ts`, `eventMigration.ts`

```typescript
const ProviderConfigSchema = z.object({
  enabled: z.boolean(),
  priority: z.number(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  rateLimit: z.number().optional(), // requests per second
  timeout: z.number().optional(), // milliseconds
  retries: z.number().optional(),
});

const ProvidersConfigSchema = z.record(
  z.string(), // provider name
  ProviderConfigSchema
);

const SettingsMetadataSchema = z.object({
  providers: ProvidersConfigSchema,
  defaultProvider: z.string(),
  fallbackOrder: z.array(z.string()).optional(),
  cacheEnabled: z.boolean().optional(),
  cacheTTL: z.number().optional(), // seconds
});

type SettingsMetadata = z.infer<typeof SettingsMetadataSchema>;

// Usage
function parseSettingsMetadata(jsonString: string): AsyncResult<SettingsMetadata> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = SettingsMetadataSchema.safeParse(parsed);
    if (!result.success) {
      return AsyncResult.err(
        new ValidationError('Invalid settings metadata', {
          cause: result.error,
          context: { errors: result.error.errors }
        })
      );
    }
    return AsyncResult.ok(result.data);
  } catch (error) {
    return AsyncResult.err(
      new ValidationError('Failed to parse settings', { cause: error })
    );
  }
}
```

### Event Configuration

```typescript
const EventConfigSchema = z.object({
  eventType: z.enum([
    'chapter_downloaded',
    'manga_added',
    'metadata_updated',
    'download_completed',
    'error_occurred'
  ]),
  enabled: z.boolean(),
  actions: z.array(z.object({
    type: z.enum(['webhook', 'notification', 'email', 'script']),
    config: z.record(z.string(), z.unknown()),
  })),
  filters: z.object({
    mangaIds: z.array(z.number()).optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
});

const EventsConfigSchema = z.array(EventConfigSchema);

type EventsConfig = z.infer<typeof EventsConfigSchema>;
```

---

## Helper Functions

### Generic JSON Parser with Validation

Create: `src/utils/json-validation.ts`

```typescript
import { z } from 'zod';
import { AsyncResult } from '@/types/result-types';
import { ValidationError } from '@/types/error-types';
import { logger } from '@/server/utils/logger';

/**
 * Safely parse JSON with Zod schema validation
 */
export function parseJsonWithSchema<T>(
  jsonString: string,
  schema: z.ZodSchema<T>,
  context?: Record<string, unknown>
): AsyncResult<T> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);

    if (!result.success) {
      logger.warn('JSON validation failed', {
        errors: result.error.errors,
        context
      });
      return AsyncResult.err(
        new ValidationError('Invalid JSON structure', {
          cause: result.error,
          context: { ...context, errors: result.error.errors }
        })
      );
    }

    return AsyncResult.ok(result.data);
  } catch (error) {
    logger.error('JSON parse error', { error, context });
    return AsyncResult.err(
      new ValidationError('Failed to parse JSON', {
        cause: error,
        context
      })
    );
  }
}

/**
 * Validate unknown data against schema (for API responses)
 */
export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context?: Record<string, unknown>
): AsyncResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    logger.warn('Data validation failed', {
      errors: result.error.errors,
      context
    });
    return AsyncResult.err(
      new ValidationError('Invalid data structure', {
        cause: result.error,
        context: { ...context, errors: result.error.errors }
      })
    );
  }

  return AsyncResult.ok(result.data);
}

/**
 * Parse JSON with fallback to default value
 */
export function parseJsonWithFallback<T>(
  jsonString: string,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Validate localStorage/sessionStorage data
 */
export function parseStorageItem<T>(
  key: string,
  schema: z.ZodSchema<T>,
  storage: Storage = localStorage
): T | null {
  const stored = storage.getItem(key);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      logger.warn('Invalid storage data', {
        key,
        errors: result.error.errors
      });
      storage.removeItem(key); // Clean up invalid data
      return null;
    }
    return result.data;
  } catch (error) {
    logger.error('Storage parse error', { key, error });
    storage.removeItem(key);
    return null;
  }
}

/**
 * Validate and transform API response with schema
 */
export async function fetchWithValidation<T>(
  url: string,
  schema: z.ZodSchema<T>,
  options?: RequestInit
): Promise<AsyncResult<T>> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      return AsyncResult.err(
        new NetworkError(`HTTP ${response.status}: ${response.statusText}`, {
          context: { url, status: response.status }
        })
      );
    }

    const data: unknown = await response.json();
    return validateData(data, schema, { url });
  } catch (error) {
    return AsyncResult.err(
      new NetworkError('Fetch failed', {
        cause: error,
        context: { url }
      })
    );
  }
}
```

### Usage Examples

```typescript
import { parseJsonWithSchema, validateData, parseStorageItem } from '@/utils/json-validation';

// Example 1: Parse JSON
const result = parseJsonWithSchema(
  jsonString,
  SettingsMetadataSchema,
  { source: 'config-file' }
);

if (result.isErr()) {
  logger.error('Failed to parse settings', { error: result.error });
  return;
}

const settings = result.value; // Typed!

// Example 2: Validate API response
const response = await axios.get<unknown>(url);
const validated = validateData(
  response.data,
  WikipediaParseResponseSchema,
  { url }
);

// Example 3: Parse localStorage
const prefs = parseStorageItem('user-prefs', UserPreferencesSchema);
if (prefs) {
  applyPreferences(prefs);
}
```

---

## Schema Organization

### Recommended Structure

```
src/
├── schemas/
│   ├── api/
│   │   ├── wikipedia-schemas.ts
│   │   ├── nzbget-schemas.ts
│   │   ├── transmission-schemas.ts
│   │   └── suwayomi-schemas.ts
│   ├── config/
│   │   ├── provider-schemas.ts
│   │   ├── event-schemas.ts
│   │   └── settings-schemas.ts
│   ├── storage/
│   │   ├── preferences-schemas.ts
│   │   └── cache-schemas.ts
│   └── index.ts (re-exports)
└── utils/
    └── json-validation.ts
```

### Example Schema File

**File:** `src/schemas/api/wikipedia-schemas.ts`

```typescript
import { z } from 'zod';

// Schemas
export const WikiTextSchema = z.object({
  '*': z.string(),
});

export const WikiParseSchema = z.object({
  title: z.string(),
  pageid: z.number(),
  text: WikiTextSchema,
  images: z.array(z.string()).optional(),
});

export const WikipediaParseResponseSchema = z.object({
  parse: WikiParseSchema,
});

// Types
export type WikiText = z.infer<typeof WikiTextSchema>;
export type WikiParse = z.infer<typeof WikiParseSchema>;
export type WikipediaParseResponse = z.infer<typeof WikipediaParseResponseSchema>;
```

---

## Testing Schemas

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { WikipediaParseResponseSchema } from '@/schemas/api/wikipedia-schemas';

describe('WikipediaParseResponseSchema', () => {
  it('validates correct response', () => {
    const validResponse = {
      parse: {
        title: 'Test',
        pageid: 123,
        text: { '*': '<html>content</html>' },
      },
    };

    const result = WikipediaParseResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('rejects invalid response', () => {
    const invalidResponse = {
      parse: {
        title: 123, // Should be string
        pageid: 'abc', // Should be number
      },
    };

    const result = WikipediaParseResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThan(0);
    }
  });
});
```

---

## Migration Checklist

For each API integration:

- [ ] Identify response structure (check logs/docs)
- [ ] Create Zod schema
- [ ] Export TypeScript type (`z.infer<>`)
- [ ] Replace `as any` with schema validation
- [ ] Add error handling
- [ ] Update tests
- [ ] Verify ESLint violations reduced

---

## Common Zod Patterns

### Optional vs Nullable

```typescript
// Field may be missing
z.string().optional() // string | undefined

// Field exists but may be null
z.string().nullable() // string | null

// Both
z.string().nullable().optional() // string | null | undefined
```

### Enums

```typescript
// String literal union
z.enum(['apple', 'banana', 'orange'])

// Native TypeScript enum
enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
z.nativeEnum(Status)
```

### Transformations

```typescript
// Parse and transform
const DateSchema = z.string().transform((str) => new Date(str));

// Coerce types
z.coerce.number() // Converts '123' to 123
z.coerce.boolean() // Converts 'true' to true
```

### Complex Validations

```typescript
// Custom refinement
const PositiveNumberSchema = z.number().refine(
  (n) => n > 0,
  { message: 'Must be positive' }
);

// Multiple conditions
const PasswordSchema = z.string()
  .min(8, 'Must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[0-9]/, 'Must contain number');
```

---

## Performance Tips

### Reuse Schemas

```typescript
// ❌ Creating schema every time
function validate(data: unknown) {
  const schema = z.object({ ... });
  return schema.parse(data);
}

// ✅ Create once, reuse
const MySchema = z.object({ ... });
function validate(data: unknown) {
  return MySchema.parse(data);
}
```

### Use `safeParse()` for Expected Failures

```typescript
// ❌ Throws error (slow if frequent)
try {
  const data = MySchema.parse(unknown);
} catch (error) {
  // handle
}

// ✅ Returns result (faster)
const result = MySchema.safeParse(unknown);
if (!result.success) {
  // handle result.error
}
```

---

## References

- **Zod Documentation:** https://zod.dev
- **AsyncResult Pattern:** `docs/user-guides/asyncresult-pattern-complete-guide.md`
- **Error Handling:** `docs/user-guides/error-handling-comprehensive-guide.md`
- **Type System:** `docs/typescript/type-system-architecture-standardization.md`

---

## Document Metadata

**Version:** 1.0
**Created:** 2025-11-09
**Author:** Systematic Plan Agent
**Status:** Ready to Use
**Canonical:** Yes

---

*Update this document as new API integrations are added to the project.*
