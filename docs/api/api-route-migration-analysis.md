# API Route Migration Analysis & Plan

*Status: Active*  
*Author: API Migration Team*  
*Canonical: Yes*  
*Date: September 2, 2025*

## Overview

This document analyzes the remaining API routes that need migration to the factory pattern, identifies deprecated endpoints for removal, and provides migration guidelines and documentation for the factory pattern.

---

## Current Migration Status

### ✅ Already Migrated (32 routes)
- **Auth Routes**: 8 routes (login, register, check, etc.)
- **Backup Routes**: 2 routes (upload, progress)
- **Proxy Routes**: 5 routes (all download clients)
- **V1 API Routes**: 13 routes (webhooks, subscriptions, monitoring, metrics)
- **Core Routes**: 4 routes (manga, prowlarr, pattern-recognition)

### 🔶 Keep As-Is (Special Handlers - 4 routes)
1. `/api/auth/[...nextauth].ts` - NextAuth handler
2. `/api/trpc/[trpc].ts` - tRPC handler
3. `/api/trpc-websocket.ts` - WebSocket handler
4. `/api/users/mockUserData.ts` - Mock data (likely for testing)

### ❌ Deprecated - Should Remove (7 routes)
1. `/api/auth/[...nextauth].v4.ts` - Old NextAuth v4 config
2. `/api/auth/custom-signout.ts` - Duplicate of signout.ts
3. `/api/auth/login-test.ts` - Test endpoint
4. `/api/debug-logs.ts` - Debug endpoint
5. `/api/debug/search-providers.ts` - Debug endpoint
6. `/api/debug/search-test.ts` - Debug endpoint
7. `/api/test/wikipedia-enrichment.ts` - Test endpoint

### 🔄 Need Migration (8 routes)

#### Simple Routes (Quick Migration)
1. **`/api/events/metadata-updates.ts`** - Standard CRUD operations
2. **`/api/metadata/comicvine/enrich.ts`** - Simple POST handler
3. **`/api/users/create.ts`** - User creation endpoint
4. **`/api/v1/openapi.json.ts`** - OpenAPI spec generator

#### Complex Routes (Need Special Consideration)
5. **`/api/image-proxy/[...path].ts`** - Binary data handling, caching
6. **`/api/reader/file/[...params].ts`** - File streaming, range requests
7. **`/api/reader/page/[...params].ts`** - Page serving, authentication
8. **`/api/proxy/prowlarr.ts`** - Proxy pass-through

---

## Migration Categories & Recommendations

### Category 1: Simple CRUD Routes ✅
**Routes**: metadata-updates, comicvine/enrich, users/create

**Migration Strategy**:
```typescript
export default createApiRoute({
  requireAuth: true,
  permissions: {
    POST: { resource: 'metadata', action: 'write' }
  },
  validation: {
    POST: schema
  },
  handlers: {
    POST: async (req, res) => {
      // Business logic here
    }
  }
});
```

### Category 2: Binary/Streaming Routes ⚠️
**Routes**: image-proxy, reader/file, reader/page

**Challenges**:
- Binary data handling
- Stream responses
- Range requests support
- Large file handling

**Recommendation**: Extend factory to support streaming:
```typescript
export default createApiRoute({
  streaming: true,
  handlers: {
    GET: async (req, res) => {
      // Set headers manually
      res.setHeader('Content-Type', 'image/jpeg');
      // Stream data
      stream.pipe(res);
    }
  }
});
```

### Category 3: Proxy Routes 🔄
**Routes**: proxy/prowlarr

**Challenges**:
- Request forwarding
- Header preservation
- Response piping

**Recommendation**: Create specialized proxy factory or keep as-is if complex.

### Category 4: Static/Documentation Routes 📄
**Routes**: openapi.json

**Migration Strategy**:
```typescript
export default createApiRoute({
  requireAuth: false,
  cache: { maxAge: 3600 }, // Cache for 1 hour
  handlers: {
    GET: async (req, res) => {
      const spec = generateOpenAPISpec();
      res.json(spec);
    }
  }
});
```

---

## Factory Pattern Enhancement Recommendations

### 1. Add Streaming Support
```typescript
interface RouteConfig {
  streaming?: boolean;
  // When true, factory won't set default headers
  // or wrap response in standard format
}
```

### 2. Add Caching Support
```typescript
interface RouteConfig {
  cache?: {
    maxAge: number; // seconds
    private?: boolean;
    sMaxAge?: number;
  };
}
```

### 3. Add Binary Response Support
```typescript
interface RouteConfig {
  binary?: boolean;
  // When true, allows Buffer/Stream responses
}
```

### 4. Add Proxy Support
```typescript
interface RouteConfig {
  proxy?: {
    target: string;
    changeOrigin?: boolean;
    preserveHeaders?: string[];
  };
}
```

---

## Implementation Plan

### Phase 1: Remove Deprecated Endpoints (Immediate)
```bash
# Remove deprecated files
rm src/pages/api/auth/[...nextauth].v4.ts
rm src/pages/api/auth/custom-signout.ts
rm src/pages/api/auth/login-test.ts
rm src/pages/api/debug-logs.ts
rm -rf src/pages/api/debug/
rm src/pages/api/test-search.ts
rm -rf src/pages/api/test/
```

### Phase 2: Migrate Simple Routes (Week 1)
1. `/api/events/metadata-updates.ts`
2. `/api/metadata/comicvine/enrich.ts`
3. `/api/users/create.ts`
4. `/api/v1/openapi.json.ts`

### Phase 3: Enhance Factory (Week 1-2)
1. Add streaming support
2. Add binary response support
3. Add caching configuration
4. Update TypeScript types

### Phase 4: Migrate Complex Routes (Week 2)
1. `/api/image-proxy/[...path].ts` (with binary support)
2. `/api/reader/file/[...params].ts` (with streaming)
3. `/api/reader/page/[...params].ts` (with streaming)
4. `/api/proxy/prowlarr.ts` (evaluate if needed)

---

## Factory Pattern Documentation

### Basic Usage
```typescript
import { createApiRoute } from '../utils/routeFactory';
import { z } from 'zod';

const requestSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

export default createApiRoute({
  // Authentication required?
  requireAuth: true,
  
  // Permission requirements per method
  permissions: {
    GET: { resource: 'users', action: 'read' },
    POST: { resource: 'users', action: 'write' }
  },
  
  // Validation schemas
  validation: {
    POST: requestSchema,
    query: querySchema // For GET query params
  },
  
  // Method handlers
  handlers: {
    GET: async (req, res) => {
      // req.auth is available when requireAuth: true
      // req.body is validated when validation provided
      const data = await fetchData();
      res.json({ status: 'success', data });
    },
    
    POST: async (req, res) => {
      const validated = req.body; // Auto-validated
      const created = await createItem(validated);
      res.status(201).json({ status: 'success', data: created });
    }
  }
});
```

### Advanced Features

#### Streaming Response
```typescript
export default createApiRoute({
  streaming: true,
  handlers: {
    GET: async (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });
      
      // Stream data
      for await (const chunk of dataStream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    }
  }
});
```

#### Binary Response
```typescript
export default createApiRoute({
  binary: true,
  handlers: {
    GET: async (req, res) => {
      const image = await loadImage();
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(Buffer.from(image));
    }
  }
});
```

#### Caching
```typescript
export default createApiRoute({
  cache: {
    maxAge: 3600, // 1 hour
    sMaxAge: 86400, // 1 day CDN cache
    private: false
  },
  handlers: {
    GET: async (req, res) => {
      // Response will have cache headers set automatically
      res.json({ data: 'cached' });
    }
  }
});
```

---

## Benefits of Migration

### Code Reduction
- **Before**: ~200 lines per route with boilerplate
- **After**: ~50 lines of focused business logic
- **Reduction**: ~75% less code

### Consistency
- Standardized error handling
- Consistent authentication checks
- Uniform permission validation
- Standard response formats

### Maintainability
- Single place to update middleware logic
- Easier to add new features (caching, rate limiting, etc.)
- Clear separation of concerns

### Developer Experience
- Less boilerplate to write
- Clear patterns to follow
- Type-safe validation
- Auto-generated documentation potential

---

## Migration Checklist

### For Each Route:
- [ ] Identify route category (CRUD, streaming, proxy, etc.)
- [ ] Check authentication requirements
- [ ] Define permission requirements
- [ ] Create validation schemas
- [ ] Migrate handlers to factory pattern
- [ ] Test all HTTP methods
- [ ] Update any client code if needed
- [ ] Remove old implementation

### Global Tasks:
- [ ] Remove all deprecated endpoints
- [ ] Enhance factory with missing features
- [ ] Document factory pattern in README
- [ ] Create migration guide for developers
- [ ] Update API documentation

---

## Summary

### Current State
- **32 routes** already migrated ✅
- **8 routes** need migration 🔄
- **7 deprecated** routes to remove ❌
- **4 special handlers** to keep as-is 🔶

### Action Items
1. **Immediate**: Remove 7 deprecated endpoints
2. **Week 1**: Migrate 4 simple routes, enhance factory
3. **Week 2**: Migrate 4 complex routes with new factory features
4. **Ongoing**: Document patterns for team

### Expected Outcome
- **50 total routes** → **39 active routes** (11 removed)
- **35 routes** using factory pattern (90% adoption)
- **4 special handlers** remaining
- **75% code reduction** in migrated routes

---

*Last Updated: September 2, 2025*  
*Next Review: September 9, 2025*