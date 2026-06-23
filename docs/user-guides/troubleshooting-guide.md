# Mugiwara-Kaizoku Troubleshooting Guide

This comprehensive guide provides solutions for common issues encountered when developing and running the Mugiwara-Kaizoku manga management application.

## Table of Contents

- [TypeScript Errors](#typescript-errors)
- [Build and Runtime Issues](#build-and-runtime-issues)
- [Database Issues](#database-issues)
- [API Integration Problems](#api-integration-problems)
- [State Management Challenges](#state-management-challenges)
- [AsyncResult Pattern Issues](#asyncresult-pattern-issues)
- [Performance Problems](#performance-problems)
- [Testing Challenges](#testing-challenges)
- [Authentication Issues](#authentication-issues)

## TypeScript Errors

### Common Type Errors

#### Problem: Type 'unknown' is not assignable to type '...'

**Cause**: Treating API responses or external data as known types without validation.

**Solution**:
1. Use type guards to validate data before using it:
```typescript
function isValidManga(manga: unknown): manga is MangaEntity {
  return (
    manga !== null && 
    typeof manga === 'object' && 
    'id' in manga && 
    'title' in manga
  );
}

// Usage
if (isValidManga(data)) {
  // data is now typed as MangaEntity
  return data.title;
}
```

2. For API responses, validate before processing:
```typescript
if (!Array.isArray(response.data)) {
  return createErrorResult(new Error('Expected array but got: ' + typeof response.data));
}
```

#### Problem: Property 'x' does not exist on type 'y'

**Cause**: Accessing properties that might not exist or using incorrect types.

**Solution**:
1. Use optional chaining and nullish coalescing:
```typescript
const title = manga?.title ?? 'Unknown';
```

2. Create property-specific type guards:
```typescript
function hasCoverUrl(obj: unknown): obj is { coverUrl: string } {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'coverUrl' in obj && 
    typeof (obj as { coverUrl?: unknown }).coverUrl === 'string'
  );
}

// Usage
const coverImage = hasCoverUrl(manga) ? manga.coverUrl : '/default-cover.jpg';
```

### Object Type Errors

#### Problem: Type '{ id: string; ... }' is missing properties from type 'RequiredType'

**Cause**: Missing required properties when creating objects.

**Solution**:
1. Use proper interfaces and provide all required properties:
```typescript
interface MangaEntity {
  id: string;
  title: string;
  coverUrl?: string;
  chapters: number;
  status: MangaStatus;
}

// Create objects with all required properties
const manga: MangaEntity = {
  id: '123',
  title: 'One Piece',
  chapters: 1050,
  status: MangaStatus.ONGOING
};
```

2. Use optional properties for non-required fields:
```typescript
interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
}
```

### Function Type Errors

#### Problem: Argument of type '...' is not assignable to parameter of type '...'

**Cause**: Passing incorrect types to functions.

**Solution**:
1. Verify parameter types match function signatures:
```typescript
// Function definition
function searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {...}

// Correct usage
searchManga('One Piece', { limit: 10 });

// Incorrect usage
searchManga(123, { limit: 'ten' }); // Type errors
```

2. Use type annotations to catch errors early:
```typescript
const options: SearchOptions = { 
  limit: 10,
  offset: 0
};
```

### AsyncResult Type Errors

#### Problem: Property 'data' does not exist on type 'AsyncResult<T, E>'

**Cause**: Accessing AsyncResult properties without checking state.

**Solution**:
1. Always use type guards to check AsyncResult state:
```typescript
import { isSuccess, isError, isLoading, isIdle } from '../utils/async-result';

const result = await fetchData();

if (isSuccess(result)) {
  return result.data; // data is typed correctly here
}
if (isError(result)) {
  console.error(result.error); // error is typed correctly here
}
```

2. Check all possible states when needed:
```typescript
if (isLoading(result)) {
  showLoadingIndicator();
} else if (isError(result)) {
  showError(result.error);
} else if (isSuccess(result)) {
  processData(result.data);
} else if (isIdle(result)) {
  startOperation();
}
```

## Build and Runtime Issues

### Next.js Build Failures

#### Problem: Failed to compile due to TypeScript errors

**Cause**: TypeScript errors in codebase.

**Solution**:
1. Run `npm run type-check` to identify errors
2. Fix all TypeScript errors before building
3. Check for common errors like missing properties or incorrect types

#### Problem: Module not found: Can't resolve '...'

**Cause**: Missing dependencies or incorrect imports.

**Solution**:
1. Verify import paths are correct (use relative paths, not alias paths)
2. Check that required packages are installed
3. Run `npm install` to ensure all dependencies are installed

### Runtime Errors

#### Problem: "TypeError: Cannot read properties of undefined"

**Cause**: Accessing properties of null or undefined objects.

**Solution**:
1. Use optional chaining:
```typescript
const title = manga?.title;
```

2. Add explicit null checks:
```typescript
if (manga && manga.title) {
  displayTitle(manga.title);
}
```

3. Provide fallback values:
```typescript
const title = manga?.title ?? 'Unknown Title';
```

#### Problem: "Maximum call stack size exceeded"

**Cause**: Infinite recursion or cyclic dependencies.

**Solution**:
1. Check for infinite loops in recursive functions
2. Look for circular dependencies in React components
3. Verify effect dependencies in React useEffect hooks
4. Add circuit breakers or iteration limits in recursive functions

## Database Issues

### Migration Problems

#### Problem: Failed migration "remove_legacy_settings"

**Cause**: Inconsistency between Prisma schema and database schema.

**Solution**:
1. Run the database auto-repair script:
```bash
./scripts/database/auto-repair.sh
```

2. If that doesn't work, apply the latest migrations:
```bash
bun run migrate
```

3. For development, consider using a clean database:
```bash
dropdb your_database
createdb your_database
bun run migrate
```

#### Problem: "column X of relation Y does not exist"

**Cause**: Missing columns in database tables compared to Prisma schema.

**Solution**:
1. Apply the latest migrations (reconciles missing columns):
```bash
bun run migrate
```

2. If specific columns are missing, add them manually:
```sql
ALTER TABLE "Settings" ADD COLUMN "fileOrganization" JSONB DEFAULT '{}'::jsonb;
```

### Connection Issues

#### Problem: Unable to connect to PostgreSQL database

**Cause**: Database not running or incorrect connection details.

**Solution**:
1. Verify PostgreSQL is running:
```bash
ps aux | grep postgres
```

2. Check connection settings in `.env` file:
```
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```

3. Try connecting manually to verify credentials:
```bash
psql -U username -d dbname -h localhost
```

## API Integration Problems

### External API Connection Issues

#### Problem: "Failed to fetch" or "Network error" when calling external APIs

**Cause**: Network connectivity issues, API rate limiting, or invalid credentials.

**Solution**:
1. Verify network connectivity
2. Check API credentials in `.env` file
3. Implement retry mechanism with exponential backoff:
```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 5;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        retries++;
        continue;
      }
      
      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * (2 ** retries)));
    }
  }
}
```

### AniList Integration Issues

#### Problem: "AniList is not properly configured for metadata"

**Cause**: Missing or incorrect AniList credentials.

**Solution**:
1. Go to Settings > Metadata > AniList
2. Ensure "Enable AniList" is turned on
3. Ensure "Use for Metadata" is turned on
4. Enter your AniList client ID and client secret
5. Ensure "Use Native Provider" is turned on
6. Save the settings

#### Problem: "Manga not found in anilist-native"

**Cause**: The manga title might be misspelled or not in AniList database.

**Solution**:
1. Double-check the spelling of the manga title
2. Try searching for a more popular manga (e.g., "One Piece" or "Naruto")
3. Verify the AniList API is accessible

### MangaDex Integration Issues

#### Problem: MangaDex API returns 403 Forbidden

**Cause**: Rate limiting or IP blocking.

**Solution**:
1. Implement rate limiting in your code:
```typescript
const RATE_LIMIT = 5; // requests per second
const queue = [];
let lastRequest = 0;

async function rateLimitedRequest(url, options) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;
  const minWaitTime = (1000 / RATE_LIMIT);
  
  if (timeSinceLastRequest < minWaitTime) {
    await new Promise(r => setTimeout(r, minWaitTime - timeSinceLastRequest));
  }
  
  lastRequest = Date.now();
  return fetch(url, options);
}
```

2. Add proper user agent headers:
```typescript
const headers = {
  'User-Agent': 'Mugiwara-Kaizoku/1.0 (your@email.com)'
};
```

## State Management Challenges

### React State Issues

#### Problem: Infinite re-renders in React components

**Cause**: Missing dependency arrays in useEffect or updating state within renders.

**Solution**:
1. Add proper dependency arrays to useEffect:
```typescript
// Incorrect - will run on every render
useEffect(() => {
  fetchData();
});

// Correct - will run only when dependencies change
useEffect(() => {
  fetchData();
}, [id, query]);
```

2. Avoid state updates during render:
```typescript
// Incorrect - updates state during render
function Component() {
  const [data, setData] = useState([]);
  if (data.length === 0) {
    setData(defaultData); // Causes re-render
  }
  return <div>{data.map(item => <div key={item.id}>{item.name}</div>)}</div>;
}

// Correct - use useEffect for initialization
function Component() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    if (data.length === 0) {
      setData(defaultData);
    }
  }, [data.length]);
  
  return <div>{data.map(item => <div key={item.id}>{item.name}</div>)}</div>;
}
```

### Library State Issues

#### Problem: "Unknown Library" displaying instead of library name

**Cause**: API endpoint mismatch or router implementation conflict.

**Solution**:
1. Fix API call by using the correct endpoint:
```typescript
// Incorrect
const { data: libraryData } = trpc.library?.query.useQuery({ id });

// Correct
const { data: libraryData } = trpc.library.detail.useQuery({ id });
```

2. Add better null checking:
```typescript
<Text size="xl" fw={700}>
  {libraryData && libraryData.name ? libraryData.name : 'Unknown Library'}
</Text>
```

## AsyncResult Pattern Issues

### Common AsyncResult Mistakes

#### Problem: Returning nested AsyncResult objects

**Cause**: Returning AsyncResult from within AsyncResult creation functions.

**Solution**:
1. Extract data early to avoid nesting:
```typescript
// Incorrect - returns nested AsyncResult
async function processData(): Promise<AsyncResult<ProcessedData, Error>> {
  try {
    const result = await fetchData();
    return createSuccessResult(result); // result is already an AsyncResult
  } catch (error) {
    return createErrorResult(error);
  }
}

// Correct - extracts data before returning
async function processData(): Promise<AsyncResult<ProcessedData, Error>> {
  try {
    const result = await fetchData();
    
    if (isError(result)) {
      return result; // Re-use the error result
    }
    
    if (!isSuccess(result)) {
      return createErrorResult(new Error('Operation failed'));
    }
    
    // Extract data early
    const data = result.data;
    
    // Process the extracted data
    const processed = transformData(data);
    
    return createSuccessResult(processed);
  } catch (error) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
```

#### Problem: Not handling all AsyncResult states

**Cause**: Only checking for success/error states and ignoring loading/idle.

**Solution**:
1. Check all possible states:
```typescript
if (isSuccess(result)) {
  return result.data;
}
if (isError(result)) {
  throw result.error;
}
if (isLoading(result)) {
  return { status: 'pending' };
}
if (isIdle(result)) {
  startOperation();
  return { status: 'started' };
}

// Always have a fallback
throw new Error('Unknown AsyncResult state');
```

### Error Handling Issues

#### Problem: Swallowing errors in AsyncResult pattern

**Cause**: Catching errors but not properly propagating them.

**Solution**:
1. Use the withEnhancedErrorHandling wrapper:
```typescript
public async searchManga(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
  return withEnhancedErrorHandling(async () => {
    try {
      const response = await this.client.search(query);
      
      if (!response || !response.data) {
        throw this.createContextualError(
          'Invalid response structure from API',
          'searchManga',
          { query }
        );
      }
      
      // Process and validate results
      return processedResults;
    } catch (error) {
      // Error is automatically enhanced with operation context
      throw error;
    }
  }, {
    operation: 'searchManga',
    service: 'MangaDexAdapter',
    details: { query }
  });
}
```

2. Always propagate errors with context:
```typescript
try {
  // Operation...
} catch (error) {
  return createErrorResult(
    error instanceof Error 
      ? error 
      : new Error(`Failed to search: ${String(error)}`)
  );
}
```

## Performance Problems

### Slow API Responses

#### Problem: API requests taking too long to complete

**Cause**: No timeout handling for API requests.

**Solution**:
1. Implement timeout protection for API calls:
```typescript
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}
```

2. Add promise race with timeout:
```typescript
async function fetchWithTimeoutRace(operation, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  
  return Promise.race([operation(), timeoutPromise]);
}
```

### React Performance Issues

#### Problem: Slow rendering or UI lag

**Cause**: Inefficient re-renders or expensive computations.

**Solution**:
1. Use React.memo for pure components:
```typescript
const MangaCard = React.memo(function MangaCard({ manga }: { manga: MangaEntity }) {
  // Component implementation
});
```

2. Use useMemo for expensive calculations:
```typescript
const sortedManga = useMemo(() => {
  return [...mangaList].sort((a, b) => a.title.localeCompare(b.title));
}, [mangaList]);
```

3. Use useCallback for event handlers:
```typescript
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query);
  fetchResults(query);
}, [fetchResults]);
```

## Testing Challenges

### Unit Test Failures

#### Problem: Tests failing with TypeScript errors

**Cause**: Type incompatibilities between test expectations and actual types.

**Solution**:
1. Use proper type definitions for test data:
```typescript
const mockManga: MangaEntity = {
  id: '1',
  title: 'Test Manga',
  chapters: 10,
  status: MangaStatus.ONGOING
};
```

2. Mock AsyncResult returns correctly:
```typescript
// Mock a success result
jest.spyOn(mangaService, 'getManga').mockResolvedValue(
  createSuccessResult<MangaEntity, Error>(mockManga)
);

// Mock an error result
jest.spyOn(mangaService, 'getManga').mockResolvedValue(
  createErrorResult<MangaEntity, Error>(new Error('Not found'))
);
```

### Integration Test Issues

#### Problem: API mocking not working correctly

**Cause**: Incorrect mock setup or response structure.

**Solution**:
1. Use MSW (Mock Service Worker) for API mocking:
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('https://api.example.com/manga/:id', (req, res, ctx) => {
    const { id } = req.params;
    
    if (id === '123') {
      return res(
        ctx.status(200),
        ctx.json({
          id: '123',
          title: 'One Piece',
          chapters: 1050
        })
      );
    }
    
    return res(
      ctx.status(404),
      ctx.json({ error: 'Manga not found' })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

2. Ensure mock response structure matches expected API structure

## Authentication Issues

### JWT Session Errors

#### Problem: "JWT_SESSION_ERROR: decryption operation failed"

**Cause**: Incorrect NEXTAUTH_URL configuration.

**Solution**:
1. Check your `.env` file and ensure `NEXTAUTH_URL` is set correctly:
   - Use `NEXTAUTH_URL=http://localhost:3000` for local development
   - **Never use** `http://0.0.0.0:3000` for NEXTAUTH_URL (causes JWT issues)

2. For network access from other devices:
   - The server will still listen on all interfaces (0.0.0.0)
   - But change NEXTAUTH_URL to your actual IP address: `NEXTAUTH_URL=http://192.168.X.X:3000`

3. Clear browser cookies and restart the application after changing settings

### Login Failures

#### Problem: Unable to log in with valid credentials

**Cause**: Misconfigured authentication settings or missing environment variables.

**Solution**:
1. Verify required environment variables are set:
```
AUTH_SECRET=your_secret_key
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000
```

2. Check that bcryptjs is properly configured for password verification

3. Clear browser cookies and session data