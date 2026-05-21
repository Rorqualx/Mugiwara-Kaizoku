# DEPLOYMENT_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DEPLOYMENT_GUIDE

---
# Kapowarr Deployment Guide

This guide covers deploying the Kapowarr native downloader in production environments.

## Overview

Kapowarr is integrated into Mugiwara-Kaizoku as a native downloader that can scrape and download manga from any website using configurable selectors. This guide covers production deployment, configuration, and optimization.

## Prerequisites

- Mugiwara-Kaizoku v1.0.0 or higher
- PostgreSQL database
- Node.js 18+ (for development)
- Docker (for containerized deployment)
- Sufficient storage for downloaded manga

## Environment Variables

Add the following environment variables for Kapowarr configuration:

```env
# Kapowarr Configuration
KAPOWARR_ENABLED=true
KAPOWARR_MAX_CONCURRENT_DOWNLOADS=3
KAPOWARR_DEFAULT_RATE_LIMIT_RPS=2
KAPOWARR_DEFAULT_RATE_LIMIT_RPM=100
KAPOWARR_DOWNLOAD_TIMEOUT=300000
KAPOWARR_PAGE_DOWNLOAD_TIMEOUT=30000
KAPOWARR_RETRY_ATTEMPTS=3
KAPOWARR_RETRY_DELAY=5000

# Storage Configuration
KAPOWARR_DOWNLOAD_PATH=/manga/downloads
KAPOWARR_TEMP_PATH=/tmp/kapowarr

# Security
KAPOWARR_ALLOWED_DOMAINS=example.com,manga-site.org
KAPOWARR_USER_AGENT="Mozilla/5.0 (compatible; Kapowarr/1.0)"

# Performance
KAPOWARR_ENABLE_CACHE=true
KAPOWARR_CACHE_TTL=3600
KAPOWARR_MAX_CACHE_SIZE=100
```

## Docker Deployment

### Docker Compose Configuration

Add Kapowarr configuration to your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mugiwara-kaizoku:
    image: mugiwara-kaizoku:latest
    environment:
      # Existing configuration...
      
      # Kapowarr
      KAPOWARR_ENABLED: "true"
      KAPOWARR_MAX_CONCURRENT_DOWNLOADS: "3"
      KAPOWARR_DEFAULT_RATE_LIMIT_RPS: "2"
      KAPOWARR_DOWNLOAD_PATH: "/manga/downloads"
      KAPOWARR_TEMP_PATH: "/tmp/kapowarr"
    volumes:
      # Existing volumes...
      
      # Kapowarr volumes
      - kapowarr_downloads:/manga/downloads
      - kapowarr_temp:/tmp/kapowarr
    networks:
      - mugiwara-net

volumes:
  kapowarr_downloads:
    driver: local
  kapowarr_temp:
    driver: local
```

### Dockerfile Updates

If building a custom image, ensure the Dockerfile includes:

```dockerfile
# Create Kapowarr directories
RUN mkdir -p /manga/downloads /tmp/kapowarr && \
    chown -R node:node /manga/downloads /tmp/kapowarr

# Set permissions
RUN chmod 755 /manga/downloads /tmp/kapowarr
```

## Database Schema

Kapowarr uses the existing Mugiwara-Kaizoku database with additional task types. During development, the schema is recreated. For production:

### Schema Recreation (Development Mode)

```bash
# Reset and recreate schema
pnpm db:reset:dev

# The schema will automatically include Kapowarr task types:
# - KAPOWARR_DOWNLOAD
# - KAPOWARR_SOURCE_SYNC
# - KAPOWARR_VALIDATE_SOURCE
```

### Production Deployment

For production, the schema is already included in the main Prisma schema. No additional migrations are needed.

## Performance Optimization

### 1. Rate Limiting

Configure rate limits per source to avoid overwhelming target websites:

```typescript
// When adding a source
{
  rateLimit: {
    requestsPerSecond: 2,      // Max 2 requests per second
    requestsPerMinute: 100,    // Max 100 requests per minute
    concurrentRequests: 3      // Max 3 concurrent requests
  }
}
```

### 2. Download Optimization

- **Concurrent Downloads**: Limit concurrent downloads to prevent resource exhaustion
- **Retry Strategy**: Implement exponential backoff for failed downloads
- **Chunk Size**: Download images in chunks for better memory management

### 3. Caching

Enable caching for frequently accessed data:

```env
KAPOWARR_ENABLE_CACHE=true
KAPOWARR_CACHE_TTL=3600        # 1 hour
KAPOWARR_MAX_CACHE_SIZE=100    # Max 100 items
```

### 4. Database Indexes

Ensure proper indexes exist for Kapowarr queries:

```sql
-- Index for download queries
CREATE INDEX idx_task_kapowarr_download 
ON "Task" (type, status) 
WHERE type IN ('KAPOWARR_DOWNLOAD', 'KAPOWARR_SOURCE_SYNC', 'KAPOWARR_VALIDATE_SOURCE');

-- Index for source lookups
CREATE INDEX idx_settings_metadata_kapowarr 
ON "Settings" ((metadata->'kapowarr'->>'sources')) 
WHERE metadata->'kapowarr' IS NOT NULL;
```

## Security Considerations

### 1. Domain Allowlist

Restrict which domains can be scraped:

```env
KAPOWARR_ALLOWED_DOMAINS=trusted-manga-site.com,another-site.org
```

### 2. User Agent

Use a descriptive user agent:

```env
KAPOWARR_USER_AGENT="Mugiwara-Kaizoku/1.0 (Kapowarr; +https://your-site.com/bot)"
```

### 3. Authentication

For sites requiring authentication, store credentials securely:

```typescript
// Use environment variables
{
  authentication: {
    type: 'basic',
    credentials: {
      username: process.env.SITE_USERNAME,
      password: process.env.SITE_PASSWORD
    }
  }
}
```

### 4. Content Validation

Always validate downloaded content:

- Check file types (should be images)
- Verify file sizes (prevent DoS)
- Scan for malicious content

## Monitoring

### 1. Health Checks

Monitor Kapowarr health through the API:

```bash
# Check overall status
curl http://localhost:3000/api/trpc/kapowarr.getStatus

# Check source health
curl http://localhost:3000/api/trpc/kapowarr.getSourceHealth
```

### 2. Metrics to Monitor

- **Download Queue Size**: Monitor for backlogs
- **Success/Failure Rates**: Track download reliability
- **Response Times**: Monitor scraping performance
- **Error Rates**: Identify problematic sources

### 3. Logging

Enable detailed logging for troubleshooting:

```env
LOG_LEVEL=info
KAPOWARR_DEBUG=false  # Set to true for verbose logging
```

## Backup and Recovery

### 1. Source Configuration Backup

Kapowarr sources are stored in the Settings table. Include in regular backups:

```sql
-- Export Kapowarr sources
SELECT metadata->'kapowarr' as kapowarr_config 
FROM "Settings" 
WHERE metadata->'kapowarr' IS NOT NULL;
```

### 2. Download State

Download progress is tracked in the Task table. For recovery:

```sql
-- Find incomplete downloads
SELECT * FROM "Task" 
WHERE type = 'KAPOWARR_DOWNLOAD' 
AND status IN ('PENDING', 'IN_PROGRESS');
```

## Troubleshooting

### Common Issues

1. **Downloads Failing**
   - Check rate limits
   - Verify selectors are up-to-date
   - Check network connectivity
   - Review error logs

2. **High Memory Usage**
   - Reduce concurrent downloads
   - Enable image streaming
   - Clear temp directory

3. **Slow Performance**
   - Optimize selectors
   - Enable caching
   - Check database indexes
   - Review rate limits

### Debug Mode

Enable debug mode for detailed logging:

```env
KAPOWARR_DEBUG=true
LOG_LEVEL=debug
```

### Manual Validation

Test sources manually:

```bash
# Via API
curl -X POST http://localhost:3000/api/trpc/kapowarr.validateSource \
  -H "Content-Type: application/json" \
  -d '{"id": "source-id"}'
```

## Scaling Considerations

### Horizontal Scaling

Kapowarr supports horizontal scaling with proper configuration:

1. **Shared Storage**: Use network storage for downloads
2. **Database Locks**: Prevent duplicate processing
3. **Load Balancing**: Distribute downloads across instances

### Vertical Scaling

For single-instance deployments:

1. **Increase Workers**: Adjust concurrent downloads
2. **Memory Allocation**: Increase Node.js heap size
3. **CPU Optimization**: Use worker threads for parsing

## Production Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] Database schema updated
- [ ] Indexes created
- [ ] Storage volumes mounted
- [ ] Rate limits configured
- [ ] Monitoring enabled
- [ ] Backup strategy defined
- [ ] Security measures implemented
- [ ] Health checks configured
- [ ] Error alerts set up

## Support

For issues specific to Kapowarr:

1. Check logs: `docker logs mugiwara-kaizoku | grep -i kapowarr`
2. Review documentation in `/docs/kapowarr/`
3. Submit issues to the Mugiwara-Kaizoku repository
4. Join the Discord community for help

## Updates and Maintenance

### Updating Sources

Sources may need updates when websites change:

1. Test existing selectors
2. Update selector configuration
3. Validate changes
4. Deploy updates

### Version Compatibility

Kapowarr is integrated into Mugiwara-Kaizoku and follows the main version:

- Mugiwara-Kaizoku v1.0.0+ includes Kapowarr
- Check release notes for Kapowarr updates
- Test updates in staging before production

---

Last Updated: January 2025
