# API Route Factory Migration Progress

## Overview
The API Route Factory pattern has been implemented to reduce boilerplate code across all API routes by ~40%. This factory provides standardized error handling, authentication, permissions, validation, and response formatting.

## Factory Location
- **Factory**: `/src/pages/api/utils/routeFactory.ts`
- **Features**:
  - Automatic method routing (GET, POST, PUT, PATCH, DELETE)
  - Built-in authentication checks
  - Permission-based authorization
  - Request validation with Zod schemas
  - Standardized error handling
  - Consistent response formatting

## Migration Benefits
1. **Reduced Boilerplate**: ~40% less code per route
2. **Consistency**: All routes follow the same pattern
3. **Type Safety**: Better TypeScript support
4. **Error Handling**: Centralized error management
5. **Security**: Automatic auth and permission checks
6. **Maintainability**: Changes to common functionality only need to be made in one place

## Migration Pattern

### Before (Traditional Pattern)
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { apiMiddleware } from '../middleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Check auth manually
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Business logic
    const data = await getData();
    
    return res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export default apiMiddleware(handler);
```

### After (Factory Pattern)
```typescript
import { createApiRoute, successResponse } from '../utils/routeFactory';

export default createApiRoute({
  GET: async (req, res) => {
    // Business logic only
    const data = await getData();
    return res.status(200).json(successResponse(data));
  }
}, {
  requireAuth: true,
  permissions: {
    GET: { resource: 'data', action: 'read' }
  }
});
```

## Migrated Routes (16/53 - 30% Complete)

### ✅ Completed Migrations
1. `/api/manga.ts` - Sample manga data endpoint
2. `/api/v1/health.ts` - Health check endpoint
3. `/api/v1/auth/keys.ts` - API key management
4. `/api/v1/metrics/system.ts` - System metrics
5. `/api/v1/metrics/api.ts` - API usage metrics
6. `/api/v1/webhooks/[id].ts` - Individual webhook operations
7. `/api/auth/check.ts` - Authentication status check
8. `/api/auth/login.ts` - User login endpoint
9. `/api/auth/register.ts` - User registration endpoint
10. `/api/auth/signout.ts` - User signout endpoint
11. `/api/auth/update-user-role.ts` - Role management endpoint
12. `/api/v1/subscriptions/index.ts` - Subscription listing and creation (NEW)
13. `/api/v1/subscriptions/[id].ts` - Individual subscription management (NEW)
14. `/api/v1/monitoring/metrics.ts` - System metrics retrieval (NEW)
15. `/api/v1/monitoring/thresholds.ts` - Alert threshold management (NEW)
16. (Partial) `/api/v1/metrics/user/[id].ts` - User-specific metrics

### 🔄 In Progress
- Proxy routes (`/api/proxy/*`)
- Event streaming routes (`/api/v1/events/*`)
- Debug routes (`/api/debug/*`)

### 📋 Pending Migration (37 routes)
- **Auth Routes** (5 remaining):
  - `/api/auth/create-user.ts`
  - `/api/auth/custom-signout.ts`
  - `/api/auth/delete-user.ts`
  - `/api/auth/login-test.ts`
  - `/api/auth/logout.ts`

- **Backup Routes** (2):
  - `/api/backup/progress/[id].ts`
  - `/api/backup/upload.ts`

- **Debug Routes** (4):
  - `/api/debug-logs.ts`
  - `/api/debug/search-providers.ts`
  - `/api/debug/search-test.ts`
  - `/api/debug/trpc-test.ts`

- **Event Routes** (2):
  - `/api/events/metadata-updates.ts`
  - `/api/v1/events/stream.ts`

- **Proxy Routes** (3):
  - `/api/image-proxy/[...path].ts`
  - `/api/proxy/transmission.ts`
  - `/api/proxy/deluge.ts`

- **Reader Routes** (2):
  - `/api/reader/page/[...params].ts`
  - `/api/reader/file/[...params].ts`

- **Subscription Routes** (2):
  - `/api/v1/subscriptions/[id].ts`
  - `/api/v1/subscriptions/index.ts`

- **Monitoring Routes** (3):
  - `/api/v1/monitoring/thresholds.ts`
  - `/api/v1/monitoring/metrics.ts`
  - `/api/v1/monitoring/alerts.ts`

- **Webhook Routes** (2):
  - `/api/v1/webhooks/index.ts`
  - `/api/v1/webhooks/[id]/test.ts`

- **Metadata Routes** (1):
  - `/api/metadata/comicvine/enrich.ts`

- **Pattern Recognition Routes** (1):
  - `/api/pattern-recognition/feedback.ts`

- **Other Routes** (1):
  - `/api/v1/openapi.json.ts`

## Code Savings Analysis

### Example: Webhook Route
- **Before**: 201 lines
- **After**: 121 lines
- **Reduction**: 40% (80 lines saved)

### Projected Total Savings
- **Total Routes**: 53
- **Migrated Routes**: 16 (30% complete)
- **Average Lines Before**: ~150 per route
- **Average Lines After**: ~90 per route
- **Lines Already Saved**: ~960 lines
- **Total Lines Saved**: ~3,180 lines (when complete)

## Next Steps

1. **Priority 1**: Complete authentication route migrations (critical path)
2. **Priority 2**: Migrate subscription and monitoring routes (user-facing)
3. **Priority 3**: Migrate proxy and reader routes (functionality)
4. **Priority 4**: Migrate debug and test routes (developer tools)

## Testing Checklist

After migration, each route should be tested for:
- [ ] Correct HTTP method handling
- [ ] Authentication enforcement (if required)
- [ ] Permission checks
- [ ] Request validation
- [ ] Error handling
- [ ] Response format consistency
- [ ] Backwards compatibility

## Migration Commands

To find remaining routes to migrate:
```bash
grep -l "export default apiMiddleware\|export default function handler\|export default async function handler" src/pages/api/**/*.ts
```

To count migrated routes:
```bash
grep -l "createApiRoute" src/pages/api/**/*.ts | wc -l
```

## Notes

- The factory pattern is particularly beneficial for routes with complex authentication and permission requirements
- Routes with special requirements (like SSE/WebSocket) may need custom handling
- Consider creating specialized factories for common patterns (e.g., CRUD operations)