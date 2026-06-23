# ComicVine Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [API Configuration](#api-configuration)
4. [Enhanced Data Integration](#enhanced-data-integration)
5. [Rate Limiting](#rate-limiting)
6. [Troubleshooting](#troubleshooting)
7. [Testing](#testing)
8. [Technical Details](#technical-details)

## Overview

ComicVine is a comprehensive comic database that provides detailed metadata for comics and manga. The integration supports:

- **Rich Metadata**: Detailed volume information including characters, staff, relations, issues, and more
- **Advanced Search**: Search by title with comprehensive results
- **Rate Limiting Protection**: Built-in rate limiting with caching and circuit breaker patterns
- **Error Handling**: Robust error handling with detailed error messages

## Setup Instructions

### 1. Enable ComicVine Provider

1. Navigate to **Settings → Metadata**
2. Find the **ComicVine** section
3. Toggle the **Enable ComicVine** switch to ON

### 2. Obtain API Key

1. Visit [ComicVine API](https://comicvine.gamespot.com/api/)
2. Create an account or sign in
3. Request an API key from your account dashboard
4. Copy your API key

### 3. Configure API Key

1. Go to **Settings → Metadata → ComicVine**
2. Paste your API key in the **API Key** field
3. Click **Save API Key**

### 4. Set as Default Provider (Optional)

1. Go to **Settings → Metadata**
2. In **Default Metadata Provider**, select **ComicVine**
3. The change saves automatically

## API Configuration

### Configuration Options

```typescript
interface ComicVineConfig {
  enabled: boolean;
  apiKey: string;
  apiEndpoint?: string;    // Default: 'https://comicvine.gamespot.com/api'
  rateLimit?: number;      // Default: 400 requests/hour
  throttleMs?: number;     // Default: 3000ms between requests
}
```

### Environment Variables

You can also configure ComicVine via environment variables:

```bash
COMICVINE_API_KEY=your-api-key-here
COMICVINE_ENABLED=true
```

## Enhanced Data Integration

### Available Metadata Fields

The enhanced integration captures comprehensive metadata:

#### Basic Information
- **Title**: Volume title
- **Publisher**: Publisher information
- **Start Year**: Publication start year
- **Issue Count**: Total number of issues
- **Volume Number**: Volume identifier
- **Aliases**: Alternative titles

#### Detailed Information
- **Description**: Full volume description
- **Deck**: Short summary
- **Site Detail URL**: Link to ComicVine page
- **Cover Images**: High-quality cover art

#### Related Entities
- **Characters**: Characters appearing in the volume
- **Staff Credits**: Writers, artists, and other creators
- **Concepts**: Themes and concepts
- **Locations**: Featured locations
- **Objects**: Important objects
- **Teams**: Teams featured
- **Story Arcs**: Connected story arcs
- **Issues**: Individual issue details

#### Dates
- **Date Added**: When added to ComicVine
- **Date Last Updated**: Last modification date

### Data Mapping

ComicVine data is mapped to the standard Kaizoku format:

```typescript
interface SearchResult {
  id: string;
  title: string;
  coverUrl?: string;
  description?: string;
  source: 'comicvine';
  sourceId: string;
  
  // Enhanced fields
  aliases?: string[];
  publisher?: string;
  volumeNumber?: string;
  dateAdded?: Date;
  dateLastUpdated?: Date;
  deck?: string;
  siteDetailUrl?: string;
  
  // Related entities
  characters?: ComicVineCharacter[];
  staff?: ComicVineStaff[];
  issues?: ComicVineIssue[];
  concepts?: ComicVineConcept[];
  locations?: ComicVineLocation[];
  objects?: ComicVineObject[];
  teams?: ComicVineTeam[];
  storyArcs?: ComicVineStoryArc[];
}
```

## Rate Limiting

### Built-in Protection

The integration includes sophisticated rate limiting:

1. **Request Throttling**
   - 1-second minimum between requests (2 seconds recommended safe delay)
   - 200 requests per hour maximum (ComicVine's actual API limit)

2. **Exponential Backoff**
   - Automatic retry with increasing delays
   - Random jitter to prevent thundering herd

3. **Circuit Breaker**
   - Temporarily pauses after 5 consecutive failures
   - 1-minute cooldown period before attempting recovery
   - Prevents API lockout

4. **Request Caching**
   - Multi-tier cache: L1 in-memory (5 min), L2 PostgreSQL (1 hour), L3 hot-data (24 hours)
   - Reduces duplicate API calls
   - Improves performance

### Rate Limit Status

Monitor rate limit status in the application logs:

```
[ComicVine] Rate limit: 175/200 requests used this hour
[ComicVine] Circuit breaker opened - pausing requests
[ComicVine] Cache hit for volume 1234
```

## Troubleshooting

### Common Issues

#### "ComicVine provider is disabled"
**Solution**: Enable the provider in Settings → Metadata → ComicVine

#### "ComicVine API key is not configured"
**Solution**: Add your API key in Settings → Metadata → ComicVine

#### "ComicVine API key is invalid"
**Solution**: 
1. Verify your API key is correct
2. Check for extra spaces or characters
3. Request a new key if needed

#### "ComicVine API rate limit exceeded"
**Solution**: 
1. Wait for the hourly limit to reset
2. Check logs for circuit breaker status
3. Consider reducing search frequency

#### "JSON parsing error"
**Solution**: 
1. Usually temporary - retry after a few minutes
2. Check ComicVine API status
3. Review error logs for details

### No Search Results

If searches return no results:

1. **Verify Integration Status**
   ```bash
   # Test script
   bun scripts/comicvine/test-comicvine-search.ts
   ```

2. **Check API Key**
   - Ensure key is valid and active
   - Test directly with ComicVine API

3. **Try Different Search Terms**
   - ComicVine focuses on Western comics
   - Some manga may have limited coverage

4. **Check Rate Limits**
   - Review application logs
   - Wait if circuit breaker is active

## Testing

### Test Scripts

```bash
# Basic search test
bun scripts/comicvine/test-comicvine-search.ts

# Enhanced API data test
node scripts/testing/test-comicvine-api-data.mjs

# Full flow test
node scripts/testing/test-comicvine-flow.js
```

### Manual Testing

1. **Search Test**
   - Search for "Batman" or "Spider-Man"
   - Verify results appear with cover images

2. **Metadata Test**
   - Select a volume from search results
   - Check all metadata fields are populated

3. **Rate Limit Test**
   - Perform multiple rapid searches
   - Verify rate limiting messages in logs

## Technical Details

### Architecture

```
ComicVineProvider                          # services/search/providers/ComicVineProvider.ts
  └── ComicVineService (API communication)  # services/comicvine/service.ts
      ├── ComicVineRateLimiter (rate limiting)   # comicvine/modules/rateLimiter.ts
      └── CircuitBreaker (failure protection)    # comicvine/modules/circuitBreaker.ts
  # results are mapped into the shared metadata types (no separate converter/cache class)
```

### API Endpoints

```typescript
// Search volumes
GET /volumes/?api_key={key}&format=json&filter=name:{query}

// Get volume details
GET /volume/4050-{id}/?api_key={key}&format=json&field_list={fields}

// Get issues
GET /issues/?api_key={key}&format=json&filter=volume:{volumeId}
```

### Error Handling

The integration uses typed errors for better debugging:

```typescript
class ComicVineError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ComicVineError';
  }
}
```

### Performance Optimization

1. **Field Lists**: Only request needed fields to reduce payload size
2. **Caching**: Multi-tier cache (5-min memory, 1-hr PostgreSQL) for repeated requests
3. **Batch Processing**: Group related requests when possible
4. **Lazy Loading**: Load detailed data only when needed

## Best Practices

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables for production

2. **Rate Limit Management**
   - Monitor usage in application logs
   - Implement user-level rate limiting if needed
   - Consider caching strategies for popular content

3. **Error Handling**
   - Always handle API errors gracefully
   - Provide meaningful error messages to users
   - Log detailed errors for debugging

4. **Data Quality**
   - ComicVine excels at Western comics
   - Consider multiple providers for manga
   - Validate data before displaying

## Additional Resources

- [ComicVine API Documentation](https://comicvine.gamespot.com/api/documentation)
- [API Forums](https://comicvine.gamespot.com/forums/api-developers-2334/)
- [Rate Limiting Best Practices](https://comicvine.gamespot.com/api/documentation#toc-0-0)

## Conclusion

The ComicVine integration provides comprehensive comic metadata with robust error handling and rate limiting protection. The enhanced data fields and caching mechanisms ensure a reliable and feature-rich experience for users seeking detailed comic information.
