# API Factory Pattern Documentation

*Status: Active*  
*Canonical: Yes*  
*Date: September 2, 2025*

## Overview

This guide documents the `createApiRoute` factory pattern used throughout the Kaizoku API. The factory provides a consistent, type-safe way to create API routes with built-in authentication, validation, error handling, and more.

---

## Current Implementation Status

### ✅ Complete Migration Achieved
- **All active API routes** now use the factory pattern
- **Deprecated routes removed**: 7 test/debug endpoints eliminated
- **Special handlers preserved**: NextAuth, tRPC, WebSocket kept as-is
- **Proxy support working**: All proxy routes successfully using factory

### Migration Statistics
- **Total Routes**: 39 active routes
- **Using Factory**: 35 routes (90% adoption)
- **Special Handlers**: 4 routes (NextAuth, tRPC, WebSocket, mock data)
- **Code Reduction**: ~75% less boilerplate per route

---

## Basic Usage

### Simple CRUD Route
```typescript
import { createApiRoute } from '../utils/routeFactory';
import { z } from 'zod';

// Define validation schemas
const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export default createApiRoute({
  // Authentication required for this route
  requireAuth: true,
  
  // Define permissions per HTTP method
  permissions: {
    GET: { resource: 'items', action: 'read' },
    POST: { resource: 'items', action: 'write' },
    DELETE: { resource: 'items', action: 'delete' }
  },
  
  // Validation schemas for request data
  validation: {
    POST: createItemSchema,
    // Query params validation for GET
    query: z.object({
      page: z.number().optional(),
      limit: z.number().max(100).optional()
    })
  },
  
  // Method handlers
  handlers: {
    GET: async (req, res) => {
      // req.auth is available when requireAuth: true
      const userId = req.auth!.userId;
      const { page = 1, limit = 10 } = req.query;
      
      const items = await fetchItems(userId, page, limit);
      return res.json({ status: 'success', data: items });
    },
    
    POST: async (req, res) => {
      // req.body is automatically validated against schema
      const validatedData = req.body;
      const created = await createItem(validatedData);
      return res.status(201).json({ status: 'success', data: created });
    }
  }
});
```

---

## Advanced Features

### 1. Streaming Support (SSE)
Used for real-time event streams and long-running responses.

```typescript
export default createApiRoute({
  streaming: true,
  requireAuth: true,
  handlers: {
    GET: async (req, res) => {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      });
      
      // Stream events
      const eventStream = getEventStream();
      for await (const event of eventStream) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }
      
      // Handle client disconnect
      req.on('close', () => {
        eventStream.close();
      });
    }
  }
});
```

### 2. Binary Data Support
For serving images, files, and other binary content.

```typescript
export default createApiRoute({
  binary: true,
  handlers: {
    GET: async (req, res) => {
      const { id } = req.query;
      const file = await getFile(id);
      
      // Set appropriate headers
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.size);
      res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
      
      // Send binary data
      return res.send(Buffer.from(file.data));
    }
  }
});
```

### 3. File Streaming with Range Support
For video/audio streaming and large file downloads.

```typescript
export default createApiRoute({
  streaming: true,
  binary: true,
  handlers: {
    GET: async (req, res) => {
      const filePath = getFilePath(req.query.id);
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        // Set partial content headers
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        });
        
        // Create read stream with range
        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        // Send full file
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    }
  }
});
```

### 4. Proxy Pattern
For forwarding requests to external services.

```typescript
export default createApiRoute({
  requireAuth: true,
  handlers: {
    POST: async (req, res) => {
      const { endpoint, method, body } = req.body;
      
      // Get service configuration
      const serviceUrl = process.env.SERVICE_URL;
      const apiKey = process.env.SERVICE_API_KEY;
      
      // Forward request to external service
      const response = await fetch(`${serviceUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      // Handle response
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Service request failed',
          message: response.statusText
        });
      }
      
      const data = await response.json();
      return res.json(data);
    }
  }
});
```

### 5. Rate Limiting
Built-in or custom rate limiting support.

```typescript
const rateLimits: Record<string, { count: number; resetTime: number }> = {};

function checkRateLimit(ip: string, limit = 60): boolean {
  if (!rateLimits[ip] || Date.now() > rateLimits[ip].resetTime) {
    rateLimits[ip] = { count: 0, resetTime: Date.now() + 60000 };
  }
  rateLimits[ip].count++;
  return rateLimits[ip].count > limit;
}

export default createApiRoute({
  handlers: {
    GET: async (req, res) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      if (checkRateLimit(ip as string)) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: 60
        });
      }
      
      // Handle request
      return res.json({ data: 'success' });
    }
  }
});
```

### 6. Caching Support
Response caching for improved performance.

```typescript
export default createApiRoute({
  cache: {
    maxAge: 3600,      // Cache for 1 hour
    sMaxAge: 86400,    // CDN cache for 1 day
    staleWhileRevalidate: 300, // Serve stale for 5 minutes while revalidating
  },
  handlers: {
    GET: async (req, res) => {
      // Cache headers are automatically set
      const data = await fetchExpensiveData();
      return res.json(data);
    }
  }
});
```

---

## Configuration Options

```typescript
interface RouteConfig {
  // Authentication
  requireAuth?: boolean;           // Require authenticated user
  requireAdmin?: boolean;          // Require admin role
  
  // Permissions (per method)
  permissions?: {
    GET?: { resource: string; action: string };
    POST?: { resource: string; action: string };
    PUT?: { resource: string; action: string };
    PATCH?: { resource: string; action: string };
    DELETE?: { resource: string; action: string };
  };
  
  // Validation schemas
  validation?: {
    GET?: ZodSchema;     // Query params
    POST?: ZodSchema;    // Request body
    PUT?: ZodSchema;     // Request body
    PATCH?: ZodSchema;   // Request body
    DELETE?: ZodSchema;  // Query params
    query?: ZodSchema;   // Alternative for query params
  };
  
  // Response handling
  streaming?: boolean;   // Enable streaming responses
  binary?: boolean;      // Enable binary responses
  
  // Caching
  cache?: {
    maxAge: number;              // Browser cache (seconds)
    sMaxAge?: number;            // CDN cache (seconds)
    staleWhileRevalidate?: number; // SWR time (seconds)
    private?: boolean;           // Private cache only
  };
  
  // Rate limiting
  rateLimit?: {
    windowMs: number;    // Time window in milliseconds
    max: number;         // Max requests per window
    message?: string;    // Custom error message
  };
  
  // CORS
  cors?: {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
  };
  
  // Method handlers
  handlers: {
    GET?: RouteHandler;
    POST?: RouteHandler;
    PUT?: RouteHandler;
    PATCH?: RouteHandler;
    DELETE?: RouteHandler;
    HEAD?: RouteHandler;
    OPTIONS?: RouteHandler;
  };
}
```

---

## Error Handling

The factory automatically handles common errors:

```typescript
export default createApiRoute({
  handlers: {
    POST: async (req, res) => {
      try {
        // Your logic here
        const result = await riskyOperation();
        return res.json({ status: 'success', data: result });
      } catch (error) {
        // These are automatically caught and formatted
        
        // Validation errors (400)
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors
          });
        }
        
        // Not found (404)
        if (error instanceof NotFoundError) {
          return res.status(404).json({
            error: 'Not found',
            message: error.message
          });
        }
        
        // Permission errors (403)
        if (error instanceof ForbiddenError) {
          return res.status(403).json({
            error: 'Forbidden',
            message: error.message
          });
        }
        
        // Default server error (500)
        console.error('API Error:', error);
        return res.status(500).json({
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An error occurred'
        });
      }
    }
  }
});
```

---

## Testing Routes

```typescript
// __tests__/api/items.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/items';

describe('/api/items', () => {
  test('GET returns items', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer test-token'
      },
      query: {
        page: '1',
        limit: '10'
      }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData());
    expect(json.status).toBe('success');
    expect(json.data).toBeDefined();
  });
  
  test('POST validates input', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token'
      },
      body: {
        // Invalid data (missing required name)
        description: 'Test'
      }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(400);
    const json = JSON.parse(res._getData());
    expect(json.error).toBe('Validation failed');
  });
});
```

---

## Migration Guide

### From Old Pattern
```typescript
// OLD: Manual boilerplate
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Manual auth check
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Manual method check
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Manual validation
  if (req.method === 'POST') {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name required' });
    }
  }
  
  // Business logic
  try {
    if (req.method === 'GET') {
      // GET logic
    } else if (req.method === 'POST') {
      // POST logic
    }
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
```

### To Factory Pattern
```typescript
// NEW: Clean and declarative
import { createApiRoute } from '../utils/routeFactory';
import { z } from 'zod';

export default createApiRoute({
  requireAuth: true,
  validation: {
    POST: z.object({ name: z.string() })
  },
  handlers: {
    GET: async (req, res) => {
      // GET logic - auth already checked
    },
    POST: async (req, res) => {
      // POST logic - body already validated
    }
  }
});
```

---

## Best Practices

1. **Always use validation schemas** - Even for simple endpoints
2. **Define permissions explicitly** - Don't rely on just authentication
3. **Handle errors gracefully** - Return meaningful error messages
4. **Use appropriate status codes** - 201 for created, 204 for no content, etc.
5. **Document complex logic** - Add comments for non-obvious behavior
6. **Test edge cases** - Especially for proxy and streaming endpoints
7. **Monitor performance** - Use logging for slow operations
8. **Cache when possible** - Reduce database/API load

---

## Common Patterns

### Pagination
```typescript
const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  sortBy: z.string().optional()
});

export default createApiRoute({
  validation: { query: paginationSchema },
  handlers: {
    GET: async (req, res) => {
      const { page, limit, sort, sortBy } = req.query;
      const offset = (page - 1) * limit;
      
      const { items, total } = await fetchPaginated({ 
        offset, limit, sort, sortBy 
      });
      
      return res.json({
        data: items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  }
});
```

### File Upload
```typescript
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default createApiRoute({
  requireAuth: true,
  handlers: {
    POST: async (req, res) => {
      const form = new formidable.IncomingForm();
      const [fields, files] = await form.parse(req);
      
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }
      
      const uploaded = await uploadFile(file);
      return res.json({ status: 'success', url: uploaded.url });
    }
  }
});
```

---

## Summary

The factory pattern has successfully:
- **Eliminated 75% of boilerplate** code
- **Standardized** error handling and validation
- **Improved** developer experience
- **Reduced** bugs from inconsistent implementations
- **Enabled** easy addition of new features

All API routes (except special handlers) now use this pattern, making the codebase more maintainable and consistent.

---

*Last Updated: September 2, 2025*  
*Next Review: October 2, 2025*