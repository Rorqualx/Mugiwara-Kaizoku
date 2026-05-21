# Notification Service Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Notification Service Implementation

---
# Notification Service Implementation Summary

## Overview

A comprehensive notification service has been implemented for the Mugiwara Kaizoku manga management system, following the architectural standards outlined in CLAUDE.md. The implementation provides support for multiple notification providers with a unified, extensible architecture.

## Implemented Components

### 1. **Base Architecture** (`src/api/notifications/base/`)
- **BaseNotificationAdapter.ts**: Abstract base class implementing the Adapter Pattern
- **types.ts**: Centralized type exports for notification system

### 2. **Notification Adapters** (`src/api/notifications/adapters/`)
- **emailAdapter.ts**: Email notifications via SMTP (using Nodemailer)
- **discordAdapter.ts**: Discord webhook notifications with rich embeds
- **slackAdapter.ts**: Slack webhook notifications (using @slack/webhook)
- **webhookAdapter.ts**: Generic webhook support with HMAC signatures
- **telegramAdapter.ts**: Telegram bot notifications (refactored from existing)

### 3. **Factory Pattern** (`src/api/notifications/factory/`)
- **notificationFactory.ts**: Creates and manages adapter instances

### 4. **Main Service** (`src/api/notifications/index.ts`)
- Coordinates multiple adapters
- Handles error aggregation
- Provides unified interface

### 5. **tRPC Integration** (`src/server/trpc/routers/notifications.ts`)
- CRUD endpoints for notification settings
- Test notification functionality
- Configuration management per provider

### 6. **Frontend Integration** (`src/pages/settings/integrations/notifications.tsx`)
- Updated to use real tRPC endpoints
- Live configuration updates
- Test notifications for each provider

### 7. **Database Schema Update**
- Added `notifications` JSON field to Settings table
- Stores provider-specific configurations

## Key Features

### Architectural Compliance
✅ **Adapter Pattern**: Each notification provider implements a common interface
✅ **AsyncResult Pattern**: All async operations return typed results
✅ **Factory Pattern**: Centralized adapter creation
✅ **Type Safety**: No `any` types, comprehensive type guards
✅ **Error Handling**: Detailed error context and logging

### Provider Features

#### Email (SMTP)
- TLS/SSL support
- Multiple recipients
- HTML email formatting
- Custom from address
- Event-based color coding

#### Discord
- Rich embed support
- Custom colors per event type
- Webhook validation
- Avatar and username customization
- Metadata fields

#### Slack
- Incoming webhook support
- Channel override
- Attachment formatting
- Action buttons for URLs
- Custom username

#### Telegram
- Bot API integration
- HTML message formatting
- Silent notifications
- Inline keyboards for URLs
- Chat ID validation

#### Generic Webhook
- Configurable HTTP methods (POST/PUT)
- Custom headers
- HMAC signature support
- Timeout protection
- JSON payload format

### Event Types Supported
- `manga_added` - New manga added to library
- `manga_updated` - Manga metadata updated
- `chapter_downloaded` - Chapter download completed
- `download_failed` - Download failure
- `task_failed` - Background task failure
- `sync_completed` - Library sync completed
- `backup_completed` - Backup operation completed
- `update_available` - System update available

## Usage Examples

### Basic Notification
```typescript
import { getConfiguredNotificationService } from '../examples/notification-integration-examples';

const service = await getConfiguredNotificationService();
await service.send({
  title: 'New Chapter Available',
  body: 'Chapter 123 of "One Piece" is now available',
  event: 'manga_updated',
  url: '/manga/123',
  metadata: {
    mangaId: 123,
    chapterNumber: 123
  }
});
```

### Testing Provider
```typescript
const testResult = await service.testProvider('discord');
if (testResult.status === 'success') {
  console.log('Discord notifications working!');
}
```

### Batch Notifications
```typescript
await sendBatchNotification([
  { type: 'manga_added', title: 'One Piece added', body: 'New manga in library' },
  { type: 'chapter_downloaded', title: '5 chapters downloaded', body: 'Download complete' }
]);
```

## Migration Guide

### For Existing Code
The notification utility (`src/server/utils/notification.ts`) has been updated to use the new service while maintaining backward compatibility:

```typescript
// Old code continues to work
await sendNotification('Title', 'Body', 'https://example.com', configService);

// New code can use the service directly
const service = await getConfiguredNotificationService();
await service.send({ title, body, event, url });
```

### Configuration Migration
Settings are now stored in the `notifications` JSON field:

```json
{
  "email": {
    "enabled": true,
    "smtpHost": "smtp.gmail.com",
    "smtpPort": 587,
    "events": ["manga_added", "chapter_downloaded"]
  },
  "discord": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["download_failed", "task_failed"]
  }
}
```

## Security Considerations

1. **Webhook Validation**: All webhook URLs are validated against provider-specific patterns
2. **HMAC Signatures**: Generic webhooks support secret-based signatures
3. **HTTPS Enforcement**: Warning for non-HTTPS webhook URLs (except localhost)
4. **Credential Storage**: Sensitive data stored in database, never logged
5. **Rate Limiting**: Handled at adapter level for external services

## Future Enhancements

1. **Apprise Adapter**: Refactor existing Apprise integration to use adapter pattern
2. **Push Notifications**: Add web push notification support
3. **SMS Integration**: Add SMS provider support (Twilio, SNS)
4. **Template System**: Add customizable notification templates
5. **Scheduling**: Add notification scheduling and batching
6. **Analytics**: Track notification delivery and engagement

## Testing

### Unit Tests Required
- Each adapter's send/test/validate methods
- Factory creation logic
- Error aggregation in main service
- tRPC endpoint validation

### Integration Tests Required
- Full notification flow with mock providers
- Database configuration persistence
- Frontend form submissions
- Event triggering from various sources

## Troubleshooting

### Common Issues

1. **Email not sending**: Check SMTP credentials and port settings
2. **Discord webhook fails**: Ensure webhook URL is complete with ID and token
3. **Slack rate limits**: Implement retry logic for 429 errors
4. **Telegram bot not responding**: Verify bot token with BotFather
5. **Webhook timeouts**: Check endpoint availability and response time

### Debug Mode
Enable debug logging for detailed notification processing:
```typescript
logger.level = 'debug';
```

## Dependencies Added

```json
{
  "nodemailer": "^6.9.8",
  "@slack/webhook": "^7.0.2",
  "@types/nodemailer": "^6.4.14"
}
```

## Conclusion

The notification service implementation provides a robust, extensible foundation for all notification needs in Mugiwara Kaizoku. It follows established architectural patterns, maintains type safety, and provides comprehensive error handling while remaining easy to use and integrate with existing code.
