# Kaizoku API v1 - Real-time Features Documentation

## Overview

This document covers the real-time features added in Phase 5 of the Kaizoku API implementation, including WebSocket support, real-time subscriptions, presence system, performance optimization, and monitoring capabilities.

## Table of Contents

1. [WebSocket Support](#websocket-support)
2. [Real-time Subscriptions](#real-time-subscriptions)
3. [Presence System](#presence-system)
4. [Performance Optimization](#performance-optimization)
5. [Monitoring & Alerting](#monitoring--alerting)

## WebSocket Support

### Connection

Connect to the WebSocket server for real-time bidirectional communication.

**URL**: `ws://localhost:3000/api/v1/ws`

**Authentication**: 
- Query parameter: `?apiKey=your-api-key`
- Or header: `X-API-Key: your-api-key`

### Message Format

All WebSocket messages follow this format:

```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  channel?: string;
}
```

### Event Types

- `connected` - Connection established
- `subscribed` - Successfully subscribed to channels
- `unsubscribed` - Unsubscribed from channels
- `message` - Incoming message on a channel
- `presence` - Presence update on a channel
- `error` - Error occurred
- `pong` - Response to ping (heartbeat)

### Channel Patterns

```typescript
// Public updates
'public:updates'

// User-specific
`user:${userId}:notifications`
`user:${userId}:activity`

// Manga-specific
`manga:${mangaId}:updates`
`manga:${mangaId}:chapters`
`manga:${mangaId}:readers`

// Library-specific
`library:${libraryId}:updates`

// Download progress
'download:progress'

// System channels
'system:alerts'
'system:updates'
```

### SDK Usage

```typescript
// Connect to WebSocket
await client.websocket.connect({
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
});

// Subscribe to channels
client.websocket.subscribe([
  'manga:1:updates',
  'public:updates'
]);

// Handle events
client.websocket.on('manga.updated', (data) => {
  console.log('Manga updated:', data);
});

// Send messages
client.websocket.send({
  type: 'chat',
  channel: 'manga:1:discussion',
  data: { message: 'Great chapter!' }
});
```

## Real-time Subscriptions

### Create Subscription

**POST** `/api/v1/subscriptions`

Create a subscription to receive real-time updates.

```json
{
  "type": "manga",
  "resourceId": "1"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "id": "sub_123",
    "userId": "user_123",
    "type": "manga",
    "resourceId": "1",
    "active": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Subscriptions

**GET** `/api/v1/subscriptions`

Get all active subscriptions for the authenticated user.

**Query Parameters**:
- `type` - Filter by subscription type
- `active` - Filter by active status

### Delete Subscription

**DELETE** `/api/v1/subscriptions/{id}`

Remove a subscription.

### Subscription Types

- `manga` - Updates for specific manga
- `library` - Updates for library changes
- `download` - Download progress and completion
- `system` - System-wide updates and alerts

## Presence System

### Join Channel with Presence

```typescript
// Join a reading room
client.websocket.presence('manga:1:readers', 'join', {
  status: 'reading',
  metadata: {
    currentChapter: 1050,
    device: 'web'
  }
});
```

### Update Presence

```typescript
// Update reading progress
client.websocket.presence('manga:1:readers', 'update', {
  metadata: {
    currentChapter: 1051,
    lastPageRead: new Date().toISOString()
  }
});
```

### Leave Channel

```typescript
// Leave the reading room
client.websocket.presence('manga:1:readers', 'leave');
```

### Presence Data Structure

```typescript
interface PresenceData {
  userId: string;
  status: string;
  metadata?: Record<string, any>;
  joinedAt: string;
  lastSeen: string;
}
```

## Performance Optimization

### Caching

The API implements multi-layer caching with automatic invalidation.

**Cache Headers**:
- `Cache-Control` - Standard HTTP caching directives
- `ETag` - Entity tags for conditional requests
- `X-Cache` - Cache status (HIT/MISS)

**Conditional Requests**:
```bash
# Request with ETag
curl -H "If-None-Match: \"abc123\"" \
  http://localhost:3000/api/v1/manga/1
```

### Compression

Responses are automatically compressed with gzip when:
- Client supports it (`Accept-Encoding: gzip`)
- Response size > 1KB

### Performance Metrics

**GET** `/api/v1/monitoring/metrics`

Get detailed performance metrics.

```json
{
  "status": "success",
  "data": {
    "api": {
      "avgResponseTime": 45.2,
      "p95ResponseTime": 120,
      "p99ResponseTime": 250,
      "requestsPerSecond": 150,
      "errorRate": 0.5,
      "cacheHitRate": 85.3
    },
    "cache": {
      "hits": 15000,
      "misses": 2500,
      "hitRate": 85.3,
      "size": 52428800,
      "itemCount": 3500
    }
  }
}
```

## Monitoring & Alerting

### Health Check

**GET** `/api/v1/health`

Check API health status.

**Query Parameters**:
- `includePerformance=true` - Include performance metrics

**Response**:
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "v1",
    "uptime": 86400,
    "checks": {
      "database": {
        "status": "healthy",
        "lastCheck": "2024-01-15T10:00:00Z"
      },
      "cache": {
        "status": "healthy",
        "lastCheck": "2024-01-15T10:00:00Z"
      },
      "websocket": {
        "status": "healthy",
        "lastCheck": "2024-01-15T10:00:00Z",
        "metadata": {
          "totalClients": 42
        }
      }
    }
  }
}
```

### Alerts

**GET** `/api/v1/monitoring/alerts`

Get active system alerts.

**Query Parameters**:
- `includeResolved=true` - Include resolved alerts
- `level` - Filter by level (info, warning, critical)
- `type` - Filter by alert type

**Response**:
```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "level": "warning",
        "type": "cpu.usage",
        "title": "High CPU Usage",
        "message": "CPU usage is at 75%",
        "timestamp": "2024-01-15T10:00:00Z",
        "resolved": false
      }
    ],
    "stats": {
      "active": 2,
      "resolved": 5,
      "critical": 0,
      "warning": 2,
      "info": 0
    }
  }
}
```

### Thresholds

**GET** `/api/v1/monitoring/thresholds`

Get monitoring thresholds.

**PUT** `/api/v1/monitoring/thresholds`

Update a threshold.

```json
{
  "metric": "cpu.usage",
  "warning": 70,
  "critical": 90,
  "duration": 60000
}
```

### Real-time Alerts via WebSocket

System alerts are broadcast in real-time to connected clients:

```typescript
client.websocket.on('system.alert', (data) => {
  console.log(`Alert: ${data.alert.title} - ${data.alert.message}`);
});
```

## Performance Best Practices

1. **Use WebSocket for Real-time Data**
   - Subscribe only to needed channels
   - Implement proper error handling and reconnection
   - Clean up subscriptions when done

2. **Leverage Caching**
   - Use ETags for conditional requests
   - Respect cache headers
   - Implement client-side caching

3. **Batch Operations**
   - Use batch endpoints when updating multiple items
   - Combine related requests when possible

4. **Monitor Performance**
   - Track response times
   - Monitor error rates
   - Set up alerts for critical metrics

## Examples

### Real-time Manga Reading Experience

```typescript
// Connect and join reading room
await client.websocket.connect();

const mangaId = 1;
const readingRoom = `manga:${mangaId}:readers`;

// Subscribe to updates
client.websocket.subscribe([
  `manga:${mangaId}:updates`,
  `manga:${mangaId}:chapters`,
  readingRoom
]);

// Join with presence
client.websocket.presence(readingRoom, 'join', {
  status: 'reading',
  metadata: { currentChapter: 1050 }
});

// Handle real-time updates
client.websocket.on('chapter.added', (data) => {
  console.log('New chapter available!', data.chapter);
});

client.websocket.on('presence', (data) => {
  console.log('Active readers:', data.data.presence.length);
});
```

### Performance Monitoring Dashboard

```typescript
// Subscribe to system metrics
client.websocket.subscribe(['system:metrics', 'system:alerts']);

// Handle metrics updates
client.websocket.on('metrics.update', (data) => {
  updateDashboard(data.metrics);
});

// Handle alerts
client.websocket.on('system.alert', (data) => {
  if (data.alert.level === 'critical') {
    showCriticalAlert(data.alert);
  }
});

// Periodically fetch detailed metrics
setInterval(async () => {
  const metrics = await client.metrics.system();
  updateDetailedMetrics(metrics.data);
}, 10000);
```

## Error Handling

WebSocket errors are handled gracefully with automatic reconnection:

```typescript
client.websocket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

client.websocket.on('reconnecting', ({ attempt, maxAttempts }) => {
  console.log(`Reconnecting... (${attempt}/${maxAttempts})`);
});

client.websocket.on('reconnected', () => {
  console.log('Successfully reconnected');
  // Re-subscribe to channels if needed
});
```

## Rate Limiting

WebSocket connections are subject to rate limiting:
- Max 1000 messages per minute per connection
- Max 100 subscriptions per connection
- Max 50 presence updates per minute

Exceeding limits results in temporary suspension with error messages.