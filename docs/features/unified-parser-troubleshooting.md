# Unified Parser - Troubleshooting Guide

## Table of Contents
- [Common Issues](#common-issues)
- [Error Types](#error-types)
- [Debugging Steps](#debugging-steps)
- [Performance Issues](#performance-issues)
- [Integration Problems](#integration-problems)
- [Edge Cases](#edge-cases)
- [Recovery Strategies](#recovery-strategies)
- [FAQ](#faq)

## Common Issues

### 1. Parser Returns Empty Results

**Symptoms:**
- Parser returns `{}` or empty arrays
- No data extracted despite valid HTML

**Causes & Solutions:**

```typescript
// Problem: Incorrect selector
const result = await parser.parseHTML(html);
// Returns: {}

// Solution 1: Check HTML structure
const $ = cheerio.load(html);
console.log($('.portable-infobox').length); // Should be > 0

// Solution 2: Use format detection
const format = await parser.detectFormat(html);
console.log(format.type); // Check detected format

// Solution 3: Handle empty content
const edgeHandler = new EdgeCaseHandler();
const handled = edgeHandler.handleEmptyContent(html, 'metadata');
```

### 2. Memory Issues with Large Documents

**Symptoms:**
- `FATAL ERROR: Reached heap limit`
- Slow processing for documents >10MB

**Solutions:**

```typescript
// Use streaming parser for large documents
import { StreamingParser } from '@/server/parsers/streaming/StreamingParser';

const streamParser = new StreamingParser({
  chunkSize: 64 * 1024, // 64KB chunks
  maxBufferSize: 1024 * 1024 // 1MB buffer
});

// Monitor progress
streamParser.on('progress', (progress) => {
  console.log(`Processed: ${progress.percentComplete}%`);
});

const result = await streamParser.parseFile('large-file.html');
```

### 3. Rate Limiting Errors

**Symptoms:**
- `429 Too Many Requests`
- `Rate limit exceeded` errors

**Solutions:**

```typescript
// Configure retry manager with rate limiting
const retryManager = new RetryManager(
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  {}, // circuit breaker options
  {
    maxRequests: 50,
    windowMs: 60000 // 1 minute
  }
);

// Use with adapter
const result = await retryManager.execute(
  () => adapter.search(query)
);
```

### 4. Cache Not Working

**Symptoms:**
- Same requests being made repeatedly
- Cache hit rate is 0%

**Diagnosis & Solutions:**

```typescript
// Check cache configuration
const metrics = parser.getMetrics();
console.log('Cache hit rate:', metrics.hitRate);

// Verify PostgreSQL connection
const cache = new PostgresCacheProvider();
const testKey = 'test-key';
await cache.set(testKey, { test: true });
const retrieved = await cache.get(testKey);
console.log('Cache working:', retrieved !== null);

// Clear corrupted cache
await cache.clear();

// Disable cache temporarily
const result = await parser.parseHTML(html, { useCache: false });
```

## Error Types

### Network Errors

```typescript
// Handle network errors
errorHandler.handleError(error, {
  source: 'network',
  operation: 'fetch',
  url: 'https://example.com'
});

// Recovery strategies
errorHandler.addRecoveryStrategy('NETWORK_ERROR-*', {
  type: 'retry',
  action: async () => {
    await delay(2000);
    return 'retry-with-backoff';
  },
  description: 'Retry with exponential backoff'
});
```

### Parse Errors

```typescript
// Fix malformed HTML
const edgeHandler = new EdgeCaseHandler();
const fixed = edgeHandler.fixMalformedHTML(brokenHtml);
console.log('Confidence:', fixed.confidence);

// Use fallback parser
if (fixed.confidence < 0.7) {
  // Use alternative parsing strategy
  const $ = cheerio.load(fixed.fixed, { xmlMode: true });
}
```

### Timeout Errors

```typescript
// Increase timeout
const parser = new CachedUnifiedParser({
  timeout: 30000 // 30 seconds
});

// Use streaming for slow sources
const result = await streamParser.parseURL(url);
```

## Debugging Steps

### 1. Enable Verbose Logging

```typescript
// Set up detailed logging
import { createMetricsCollector } from '@/server/parsers/monitoring/MetricsCollector';

const metrics = createMetricsCollector({
  enableAlerts: true
});

// Monitor all events
parser.on('error', (error) => {
  console.error('Parser error:', error);
});

parser.on('warning', (warning) => {
  console.warn('Parser warning:', warning);
});
```

### 2. Check Input Validation

```typescript
// Validate HTML input
function validateHTML(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }
  
  // Check for minimum valid HTML
  if (html.length < 10) {
    return false;
  }
  
  // Check for HTML tags
  if (!/<[^>]+>/.test(html)) {
    return false;
  }
  
  return true;
}

// Validate before parsing
if (!validateHTML(input)) {
  throw new Error('Invalid HTML input');
}
```

### 3. Test Individual Components

```typescript
// Test format detection
const format = await parser.detectFormat(html);
console.log('Detected format:', format);

// Test table extraction
const $ = cheerio.load(html);
const tables = await parser.extractTables($);
console.log('Tables found:', tables.length);

// Test image extraction
const images = await parser.extractImages($);
console.log('Images found:', images.length);
```

### 4. Monitor Performance

```typescript
// Use metrics collector
const metrics = parser.getMetrics();
console.log('Performance metrics:', {
  avgParseTime: metrics.avgParseTime,
  cacheHitRate: metrics.hitRate,
  totalParses: metrics.totalParses
});

// Run benchmark
import { runBenchmark } from '@/server/parsers/benchmark/runBenchmark';
const results = await runBenchmark();
```

## Performance Issues

### Slow Parsing

**Diagnosis:**
```typescript
// Measure parse time
const start = Date.now();
const result = await parser.parseHTML(html);
const duration = Date.now() - start;

if (duration > 5000) {
  console.warn(`Slow parse: ${duration}ms`);
}
```

**Solutions:**
1. Enable caching
2. Use streaming for large documents
3. Increase concurrency for batch operations
4. Optimize selectors

### High Memory Usage

**Monitor memory:**
```typescript
const memBefore = process.memoryUsage().heapUsed;
const result = await parser.parseHTML(html);
const memAfter = process.memoryUsage().heapUsed;
const memUsed = (memAfter - memBefore) / 1024 / 1024;

console.log(`Memory used: ${memUsed.toFixed(2)}MB`);
```

**Solutions:**
1. Use streaming parser
2. Clear cache regularly
3. Limit concurrent operations
4. Increase Node.js heap size

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## Integration Problems

### Adapter Not Working

```typescript
// Test adapter directly
const adapter = new MangaDexAdapter();

try {
  const result = await adapter.search('test');
  console.log('Adapter working:', result.length > 0);
} catch (error) {
  console.error('Adapter error:', error);
}

// Check API credentials
if (!process.env.MANGADEX_API_KEY) {
  console.error('Missing API key');
}
```

### Feature Flags Not Applied

```typescript
// Verify feature flags
const flags = getFeatureFlags();
console.log('Parser enabled:', flags.isEnabled('USE_UNIFIED_PARSER'));

// Force enable for testing
await flags.setFlag('USE_UNIFIED_PARSER', true);
await flags.setFlag('ROLLOUT_PERCENTAGE', 100);
```

## Edge Cases

### Malformed HTML

```typescript
const edgeHandler = new EdgeCaseHandler();

// Register custom edge case
edgeHandler.registerEdgeCase({
  id: 'broken-table',
  pattern: /<table[^>]*>[^<]*<\/table>/,
  description: 'Empty table',
  severity: 'low',
  handler: (html) => {
    return { headers: [], rows: [] };
  },
  fallback: { error: 'Invalid table structure' }
});

// Handle edge case
const result = edgeHandler.handle(html, 'table');
if (result.handled) {
  console.log('Edge case handled:', result.caseId);
}
```

### Circular References

```typescript
// Detect and fix circular references
const cleaned = edgeHandler.removeCircularReferences(data);
```

### Mixed Content Types

```typescript
// Handle mixed HTML/JSON content
const mixed = edgeHandler.handleMixedContent(content);
console.log('Content types found:', Object.keys(mixed));
```

## Recovery Strategies

### Automatic Recovery

```typescript
// Set up automatic recovery
const errorHandler = new ErrorHandler({
  enableAutoRecovery: true
});

// Add custom recovery strategies
errorHandler.addRecoveryStrategy('PARSE_ERROR-fandom', {
  type: 'fallback',
  action: async () => {
    // Try alternative parser
    return await alternativeParser.parse(html);
  },
  description: 'Use alternative parser'
});
```

### Manual Recovery

```typescript
try {
  const result = await parser.parseHTML(html);
} catch (error) {
  // Manual recovery steps
  
  // 1. Try fixing the HTML
  const fixed = edgeHandler.fixMalformedHTML(html);
  
  // 2. Try with different options
  const result = await parser.parseHTML(fixed.fixed, {
    useCache: false,
    strict: false
  });
  
  // 3. Use fallback
  if (!result) {
    return getDefaultMetadata();
  }
}
```

### Circuit Breaker Reset

```typescript
// Reset circuit breaker after failures
retryManager.resetCircuit();

// Check circuit state
const metrics = retryManager.getMetrics();
if (metrics.circuitState === 'OPEN') {
  console.warn('Circuit breaker is open');
  // Wait before retrying
  await delay(30000);
  retryManager.resetCircuit();
}
```

## FAQ

### Q: Why is the parser returning different results than the old parser?

**A:** The unified parser uses improved extraction algorithms. To compare:

```typescript
// Compare results
const oldResult = await oldParser.parse(html);
const newResult = await unifiedParser.parseHTML(html);

// Log differences
console.log('Differences:', {
  oldKeys: Object.keys(oldResult),
  newKeys: Object.keys(newResult)
});
```

### Q: How do I disable the unified parser temporarily?

**A:** Use feature flags:

```typescript
// Disable globally
await flags.setFlag('USE_UNIFIED_PARSER', false);

// Or disable for specific source
await flags.setFlag('USE_UNIFIED_FOR_FANDOM', false);
```

### Q: How do I debug cache issues?

**A:** Check cache operations:

```typescript
// Enable cache debugging
const cache = new PostgresCacheProvider({
  debug: true
});

// Monitor cache operations
cache.on('hit', (key) => console.log('Cache hit:', key));
cache.on('miss', (key) => console.log('Cache miss:', key));
cache.on('set', (key) => console.log('Cache set:', key));
```

### Q: What should I do if parsing is stuck?

**A:** Implement timeout and abort:

```typescript
// With timeout
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 10000)
);

const result = await Promise.race([
  parser.parseHTML(html),
  timeoutPromise
]);

// Abort streaming parser
const streamParser = new StreamingParser();
setTimeout(() => streamParser.abort(), 10000);
```

### Q: How do I handle authentication errors?

**A:** Check and refresh credentials:

```typescript
// Check authentication
if (error.message.includes('401') || error.message.includes('unauthorized')) {
  // Refresh token
  const newToken = await refreshAuthToken();
  adapter.updateConfig({ accessToken: newToken });
  
  // Retry
  const result = await adapter.getManga(id);
}
```

## Getting Help

### Logs Location
- Application logs: `/var/log/unified-parser/`
- Error logs: `/var/log/unified-parser/errors.log`
- Performance logs: `/var/log/unified-parser/performance.log`

### Debug Commands

```bash
# Check parser status
npm run parser:status

# Run diagnostics
npm run parser:diagnose

# Clear cache
npm run parser:clear-cache

# Run benchmark
npm run parser:benchmark
```

### Support Channels
- GitHub Issues: [Report bugs](https://github.com/yourrepo/issues)
- Documentation: [Full documentation](https://docs.yoursite.com)
- Discord: [Community support](https://discord.gg/yourserver)

## Error Codes Reference

| Code | Type | Description | Solution |
|------|------|-------------|----------|
| E001 | PARSE_ERROR | Invalid HTML structure | Fix HTML or use edge case handler |
| E002 | NETWORK_ERROR | Connection failed | Check network, retry |
| E003 | TIMEOUT_ERROR | Request timeout | Increase timeout, use streaming |
| E004 | RATE_LIMIT_ERROR | Too many requests | Reduce frequency, wait |
| E005 | CACHE_ERROR | Cache operation failed | Check DB connection, clear cache |
| E006 | MEMORY_ERROR | Out of memory | Use streaming, increase heap |
| E007 | PERMISSION_ERROR | Access denied | Check credentials |
| E008 | VALIDATION_ERROR | Invalid input | Validate input data |