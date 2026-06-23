# Anilist Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Anilist Guide

---
# AniList Integration Guide (Native API)

> ⚠️ **IMPORTANT**: This guide covers Kaizoku's native AniList integration for metadata. 
> 
> **CLARIFICATION**: 
> - Mangal IS SUPPORTED as a manga downloader
> - Kaizoku uses its OWN native AniList integration for metadata
> - Kaizoku does NOT use mangal's built-in AniList features
>
> **Last Updated**: January 2025  
> **Status**: Active Standard

## Overview

AniList integration in Mugiwara-Kaizoku uses the **native AniList GraphQL API directly** for metadata retrieval. This is separate from mangal, which is used for downloading manga chapters.

## Architecture Clarification

```
Kaizoku System:
├── Manga Downloading
│   ├── Mangal (CLI tool) ✅ SUPPORTED
│   └── Suwayomi ✅ SUPPORTED
│
└── Metadata Providers
    ├── Native AniList Integration ✅ (This guide)
    ├── ComicVine
    ├── MangaDex
    └── Fandom
    
NOT USED: Mangal's built-in AniList integration ❌
```

## Key Points

- ✅ **Native API Integration**: Direct GraphQL queries to AniList for metadata
- ✅ **Mangal for Downloads**: Mangal CLI is used for downloading chapters
- ❌ **NO Mangal AniList**: We don't use mangal's built-in AniList features
- ✅ **OAuth Support**: Optional authentication for user features
- ✅ **Public Access**: Most features work without authentication

## Configuration

### Basic Configuration (No Auth)

```typescript
const anilistConfig = {
  enabled: true,
  apiUrl: 'https://graphql.anilist.co',
  // No auth token required for public queries
};
```

### Authenticated Configuration

```typescript
const anilistConfig = {
  enabled: true,
  apiUrl: 'https://graphql.anilist.co',
  authToken: 'your-oauth-token', // Optional
  rateLimit: 90, // Requests per minute
};
```

## Implementation

The AniList adapter is located at `src/api/metadataProviders/adapters/anilistAdapter.ts`:

```typescript
import { AniListAdapter } from '../adapters/anilistAdapter';

// Create adapter instance
const adapter = new AniListAdapter({
  enabled: true,
  apiUrl: 'https://graphql.anilist.co'
});

// Search for manga
const results = await adapter.search('One Piece');

// Get manga details
const manga = await adapter.getMangaById('21');
```

## Available Features

### Without Authentication
- Search manga by title
- Get manga details by ID
- Retrieve chapter information
- Access cover images and metadata

### With Authentication
- Sync reading progress
- Update manga status
- Access user lists
- Rate manga

## GraphQL Queries

The adapter uses these primary queries:

### Search Query
```graphql
query SearchManga($search: String!) {
  Page(page: 1, perPage: 20) {
    media(search: $search, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      status
      chapters
      volumes
      coverImage {
        large
        medium
      }
    }
  }
}
```

### Details Query
```graphql
query GetMangaDetails($id: Int!) {
  Media(id: $id, type: MANGA) {
    id
    title {
      romaji
      english
      native
    }
    description
    status
    chapters
    volumes
    startDate {
      year
      month
      day
    }
    genres
    tags {
      name
      rank
    }
  }
}
```

## Status Mapping

AniList statuses are automatically mapped to domain statuses:

| AniList Status | Domain Status |
|----------------|---------------|
| RELEASING | ONGOING |
| FINISHED | COMPLETED |
| CANCELLED | CANCELLED |
| HIATUS | HIATUS |
| NOT_YET_RELEASED | UNKNOWN |

## Error Handling

The adapter includes comprehensive error handling:

```typescript
try {
  const results = await adapter.search(query);
  return results;
} catch (error) {
  if (error.message.includes('429')) {
    // Rate limit exceeded
    throw new Error('AniList rate limit exceeded. Please wait before retrying.');
  }
  throw error;
}
```

## Common Issues and Solutions

### Issue: Confusion about mangal vs AniList
**Clarification**: 
- Mangal = manga downloader (chapters)
- AniList = metadata provider (info, covers, descriptions)
- They work together but serve different purposes

### Issue: Rate Limiting
**Solution**: The adapter includes built-in rate limiting. Default is 90 requests/minute.

### Issue: Authentication Required
**Solution**: Some features require OAuth. See the authentication guide for setup.

## Migration from Mangal's AniList to Native

If you have code trying to use mangal's built-in AniList integration:

### ❌ DON'T USE (Mangal's AniList)
```typescript
// We don't use mangal's AniList features
// Mangal is only for downloading chapters
```

### ✅ USE (Native AniList)
```typescript
// Use native adapter for metadata
const adapter = new AniListAdapter(config);
const results = await adapter.search(query);
```

## Testing

To test AniList integration:

```bash
# Run integration tests
npm run test:integration -- anilist

# Test specific functionality
npm run dev
# Navigate to search and select AniList as provider
```

## Related Files

- `src/api/metadataProviders/adapters/anilistAdapter.ts` - Main adapter
- `src/types/integrations/anilist.ts` - Type definitions
- `src/utils/status-mapping.ts` - Status mapping utilities

## Related Documentation

### Correct/Current:
- This guide - Native AniList integration for metadata
- `mangal-setup.md` - Mangal configuration for downloading
- `src/server/services/mangal/*` - Mangal download services

### Potentially Confusing:
- Any documentation mentioning "mangal AniList integration" - We use native AniList, not mangal's

---

**Remember**: 
- **Mangal** = Chapter downloading ✅
- **Native AniList** = Metadata provider ✅
- **Mangal's AniList** = Not used ❌

---

## Document History

- **Created**: $(date +"%Y-%m-%d") - Consolidated from multiple AniList documentation files
- **Status**: Active
- **Maintainer**: Documentation Team

## See Also

- AniList User Guide
- AniList Implementation Reference
- AniList Troubleshooting
