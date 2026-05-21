# QUICK_REFERENCE_CARD

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for QUICK_REFERENCE_CARD

---
# 🎯 Kapowarr Quick Reference Card

## Essential Commands

```bash
# Setup
./scripts/setup-kapowarr.sh

# Start development
pnpm dev

# Run tests
pnpm test -- --testPathPattern=kapowarr

# Build
pnpm build:clean
```

## Selector Cheat Sheet

### Basic Selectors
```javascript
// Text content
{ css: '.title', extract: 'text' }

// Attribute
{ css: 'img', extract: 'attribute', attribute: 'src' }

// HTML
{ css: '.content', extract: 'html' }
```

### With Transforms
```javascript
// Remove whitespace
{ 
  css: '.title', 
  extract: 'text',
  transform: [{ type: 'trim', params: {} }]
}

// Replace text
{
  css: '.chapter',
  extract: 'text', 
  transform: [{
    type: 'replace',
    params: { search: 'Chapter', replace: 'Ch.' }
  }]
}

// Add prefix
{
  css: 'img',
  extract: 'attribute',
  attribute: 'src',
  transform: [{
    type: 'prefix',
    params: { value: 'https://cdn.example.com' }
  }]
}
```

## Common Configurations

### Search Results
```javascript
searchResults: {
  container: '.manga-list .item',
  id: { css: '.manga-id', extract: 'text' },
  title: { css: '.title', extract: 'text' },
  coverUrl: { css: 'img', extract: 'attribute', attribute: 'src' },
  url: { css: 'a', extract: 'attribute', attribute: 'href' }
}
```

### Chapter List
```javascript
chapterList: {
  container: '.chapters li',
  chapterId: { css: '.id', extract: 'text' },
  chapterNumber: { css: '.num', extract: 'text' },
  chapterTitle: { css: '.title', extract: 'text' },
  chapterUrl: { css: 'a', extract: 'attribute', attribute: 'href' }
}
```

### Download Links
```javascript
downloadLinks: {
  imageContainer: '.pages',
  imageUrl: { css: 'img', extract: 'attribute', attribute: 'src' }
}
```

## Rate Limiting

```javascript
rateLimit: {
  requestsPerSecond: 2,      // Max per second
  requestsPerMinute: 100,    // Max per minute  
  concurrentRequests: 3      // Max simultaneous
}
```

## Authentication Types

```javascript
// Basic Auth
authentication: {
  type: 'basic',
  credentials: {
    username: 'user',
    password: 'pass'
  }
}

// Bearer Token
authentication: {
  type: 'bearer',
  credentials: {
    token: 'your-token'
  }
}

// Cookies
authentication: {
  type: 'cookie',
  credentials: {
    cookies: 'session=abc123'
  }
}
```

## Transform Types

| Transform | Purpose | Example |
|-----------|---------|---------|
| `trim` | Remove whitespace | `{ type: 'trim', params: {} }` |
| `replace` | Replace text | `{ type: 'replace', params: { search: 'a', replace: 'b' } }` |
| `regex` | Regex replace | `{ type: 'regex', params: { pattern: '\\d+', replace: '$&' } }` |
| `prefix` | Add to start | `{ type: 'prefix', params: { value: 'https://' } }` |
| `suffix` | Add to end | `{ type: 'suffix', params: { value: '.jpg' } }` |
| `split` | Split & select | `{ type: 'split', params: { delimiter: ',', index: 0 } }` |

## API Endpoints

```typescript
// Source Management
trpc.kapowarr.getSources()
trpc.kapowarr.addSource({ name, baseUrl, config })
trpc.kapowarr.updateSource({ id, ...updates })
trpc.kapowarr.removeSource({ id })

// Search
trpc.kapowarr.search({ query, options })
trpc.kapowarr.searchSource({ sourceId, query })

// Downloads
trpc.kapowarr.downloadChapter({ sourceId, mangaId, chapterId })
trpc.kapowarr.getDownloads()
trpc.kapowarr.cancelDownload({ id })

// Validation
trpc.kapowarr.validateSource({ id })
trpc.kapowarr.syncSource({ id })
```

## Environment Variables

```env
# Essential
KAPOWARR_ENABLED=true
KAPOWARR_DOWNLOAD_PATH=/manga/downloads

# Performance
KAPOWARR_MAX_CONCURRENT_DOWNLOADS=3
KAPOWARR_DEFAULT_RATE_LIMIT_RPS=2

# Timeouts
KAPOWARR_DOWNLOAD_TIMEOUT=300000
KAPOWARR_PAGE_DOWNLOAD_TIMEOUT=30000

# Cache
KAPOWARR_ENABLE_CACHE=true
KAPOWARR_CACHE_TTL=3600
```

## Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| No results | Search URL | Update selectors |
| Download fails | Image selectors | Check attributes |
| Rate limited | Request frequency | Lower limits |
| Auth fails | Credentials | Update auth config |
| Slow downloads | Concurrent limits | Adjust settings |

## File Locations

```
/src/types/domain/kapowarr-types.ts        # Types
/src/services/kapowarr/                    # Services
/src/components/settings/kapowarr/         # UI
/src/server/trpc/routers/kapowarr.ts      # API
/docs/kapowarr/                            # Docs
```

---

**Need Help?** 
- User Guide: `/docs/kapowarr/USER_GUIDE.md`
- Config Guide: `/docs/kapowarr/CONFIGURATION_GUIDE.md`
- Dev Guide: `/docs/kapowarr/DEVELOPER_GUIDE.md`
