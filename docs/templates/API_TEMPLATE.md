# [API Endpoint/Service Name] API Documentation

> **Status**: [Draft | Review | Approved]  
> **Type**: API Documentation  
> **Version**: [1.0.0]  
> **Last Updated**: [Date]

## Overview

[Brief description of what this API does]

## Authentication

[Describe authentication requirements]

```typescript
// Example authentication header
Authorization: Bearer <token>
```

## Base URL

```
Production: https://api.example.com/v1
Development: http://localhost:3000/api/v1
```

## Endpoints

### `GET /endpoint`

[Description of what this endpoint does]

#### Request

```http
GET /endpoint?param1=value&param2=value
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param1 | `string` | No | Description |
| param2 | `number` | No | Default: 10 |

#### Response

```typescript
interface Response {
  data: {
    id: string;
    name: string;
    // ...
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

#### Example Response

```json
{
  "data": [
    {
      "id": "123",
      "name": "Example"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

### `POST /endpoint`

[Description]

#### Request

```http
POST /endpoint
Content-Type: application/json
Authorization: Bearer <token>

{
  "field1": "value",
  "field2": 123
}
```

#### Request Body

```typescript
interface RequestBody {
  field1: string;
  field2: number;
  field3?: boolean;
}
```

#### Response

```typescript
interface Response {
  id: string;
  createdAt: string;
  // ...
}
```

### `PUT /endpoint/:id`

[Description]

#### Parameters

| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| id | `string` | path | Resource ID |

#### Request Body

[Same as POST or describe differences]

### `DELETE /endpoint/:id`

[Description]

#### Parameters

| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| id | `string` | path | Resource ID |

#### Response

```json
{
  "success": true,
  "message": "Resource deleted"
}
```

## Error Responses

### Error Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  statusCode: number;
}
```

### Common Errors

| Status Code | Error Code | Description |
|------------|------------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## Rate Limiting

- **Rate limit**: 100 requests per minute
- **Headers returned**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Pagination

Use query parameters for pagination:

```
?page=1&limit=20
```

## Filtering and Sorting

### Filtering

```
?filter[field]=value
?filter[field][$gte]=100
```

### Sorting

```
?sort=field1,-field2  // + for ASC, - for DESC
```

## Webhooks

[If applicable, describe webhook events]

### Event Types

- `resource.created`
- `resource.updated`
- `resource.deleted`

### Webhook Payload

```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    // Event-specific data
  };
}
```

## SDK Usage

```typescript
import { APIClient } from '@/lib/api-client';

const client = new APIClient({
  apiKey: process.env.API_KEY,
});

// Example usage
const data = await client.endpoint.get({ param1: 'value' });
```

## Testing

### Test Endpoints

```
GET /health - Health check
GET /test - Test endpoint (dev only)
```

### Example cURL Commands

```bash
# GET request
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/v1/endpoint"

# POST request
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field1":"value"}' \
  "https://api.example.com/v1/endpoint"
```

## Changelog

- **v1.0.0** - Initial release
- **v1.1.0** - Added filtering support

## Related Documentation

- API Client Guide
- Authentication Guide
- Error Handling

---

**API Support**: api-support@example.com
